/**
 * Transfer server functions
 */
const { createServer } = require('net')
const { logger } = require('./logger')
const clients = require('./connection/clients')
const { OfflineTransferModel } = require('./model/offlineTransfer')
const config = require('./config')
const { createWriteStream, createReadStream } = require('fs')
const request = require('./request')
const { callbacks } = require('./request/transmit')

/**
 * Start transfer listening server
 * @param {string} host Host to listen
 * @param {number} port Port to listen
 */
function startTransferServer (host, port) {
  logger.info(`Transfer server starting on ${host}:${port}...`)
  const server = createServer()
  /* Event server started */
  server.on('listening', () => {
    logger.info('Transfer server started')
  })
  /* Connection received */
  server.on('connection', (client) => {
    logger.info(`Received transfer connection from ${client.remoteAddress}:${client.remotePort}`)
    clients.register(client.remoteAddress, client.remotePort, client)
    client.on('data', process(client))
    client.on('close', () => {
      logger.info(`Transfer connection from ${client.remoteAddress}:${client.remotePort} closed`)
      clients.del(client.remoteAddress, client.remotePort)
    })
    client.on('error', (err) => {
      logger.error(`Socket error. ${err}`)
    })
  })
  server.on('error', (err) => {
    logger.error(`Socket error. ${err}`)
  })
  /* Start listening */
  server.listen(port, host)
}

function process (client) {
  let buffer = Buffer.alloc(0)
  return (data) => {
    logger.debug(`Transfer server receiving data ${data}`)
    buffer = Buffer.concat([buffer, data])

    if (buffer[0] === 48 && buffer[1] === 10) { // 0\n
      /* Transmit */
      const pos = buffer.indexOf('\n', 2)
      if (pos === -1) {
        logger.info('Received incomplete payload')
        return
      }
      const id = buffer.slice(2, pos).toString('ascii')
      if (callbacks.has(id)) {
        logger.debug(`call callback of ${id}`)
        const cb = callbacks.get(id)
        cb(client).catch((err) => { logger.error(err) })
        callbacks.delete(id)
      } else {
        logger.error(`Tramsmit id no callback: ${id}`)
      }
      buffer = buffer.slice(pos + 1)
    } else if (buffer[0] === 49 && buffer[1] === 10) { // 1\n
      /* Offline transfer upload */
      const pos1 = buffer.indexOf('\n', 2)
      if (pos1 === -1) return
      const pos2 = buffer.indexOf('\n', pos1 + 1)
      if (pos2 === -1) return
      /* Parse transferKey and size in packet */
      const transferKey = buffer.slice(2, pos1).toString()
      const size = parseInt(buffer.slice(pos1 + 1, pos2))
      OfflineTransferModel.findOne({ transferKey }) // Find specific OfflineTransfer in database
        .then(offlineTransfer => {
          /* If not found, response reject */
          if (offlineTransfer === null) {
            client.write('rej')
            return
          }
          logger.debug(offlineTransfer)
          /* Build upload file path */
          const path = `${config.offlineDir}/${transferKey}`
          OfflineTransferModel.updateOne({ _id: offlineTransfer._id }, { $set: { path } }) // Set path
            .then(() => {
              client.removeAllListeners('data') // Remove all current registered 'on data' event
              client.write('ok') // Response ok
              const writeStream = createWriteStream(path) // Create file write stream
              writeStream.on('error', async err => {
                logger.error(`Error occurs when receiving offline transfer file. ${err}`)
                await OfflineTransferModel.deleteOne({ _id: offlineTransfer._id }) // Delete offlineTransfer when error
                client.end()
              })
              client.pipe(writeStream) // Pipe client with write stream. client->writeStream
              let received = 0
              client.on('data', data => { received += data.length })
              writeStream.on('close', () => {
                if (received === size) { // If received length equals size, indicated that the transfer is successful
                  logger.debug(`Received offline transfer ${offlineTransfer._id} file`)
                  OfflineTransferModel.updateOne({ _id: offlineTransfer._id }, { $set: { status: 1 } }) // Update status
                    .then(() => {
                      request.sendOfflineTransfersByUserId(offlineTransfer.toUserId) // Send offlineTransfer info to receiver
                    })
                } else { // Otherwise, it is failed
                  logger.debug(`Offline transfer ${offlineTransfer._id} file is not completed`)
                  OfflineTransferModel.deleteOne({ _id: offlineTransfer._id }).then(() => {}) // Delete failed transfer
                }
              })
            })
        })
    } else if (buffer[0] === 50 && buffer[1] === 10) { // 2\n
      /* Offline transfer download */
      const pos = buffer.indexOf('\n', 2)
      if (pos === -1) return
      /* Parse transferKey in packet */
      const transferKey = buffer.slice(2, pos).toString()
      OfflineTransferModel.findOne({ transferKey }) // Find specific OfflineTransfer in database
        .then(offlineTransfer => {
          /* If not found, response reject */
          if (offlineTransfer === null) {
            client.write('rej')
            return
          }
          client.removeAllListeners('data') // Remove all current registered 'on data' event
          const readStream = createReadStream(offlineTransfer.path) // Create file read stream
          readStream.on('error', async err => {
            logger.error(`Error occurs when pushing offline transfer file. ${err}`)
            client.end() // Disconnect when error
          })
          readStream.pipe(client) // Pipe read stream with client. readStream->client
          client.on('close', () => {
            logger.info(`Offline transfer ${offlineTransfer._id} file sent or failed`)
          })
        })
    } else {
      /* Ignore invalid header */
      buffer = buffer.slice(2)
    }
  }
}

module.exports = {
  startTransferServer
}
