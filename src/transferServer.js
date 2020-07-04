const { createServer } = require('net')
const { logger } = require('./logger')
const clients = require('./connection/clients')
const { OfflineTransferModel } = require('./model/offlineTransfer')
const config = require('./config')
const { createWriteStream, createReadStream } = require('fs')
const request = require('./request')

/**
 * Start transfer listening server
 * @param {string} host Host to listen
 * @param {number} port Port to listen
 */
function startTransferServer (host, port) {
  logger.info(`Server starting on ${host}:${port}...`)
  const server = createServer()
  /* Event server started */
  server.on('listening', () => {
    logger.info('Server started')
  })
  /* Connection received */
  server.on('connection', (client) => {
    logger.info(`Received connection from ${client.remoteAddress}:${client.remotePort}`)
    clients.register(client.remoteAddress, client.remotePort, client)
    client.on('data', process(client))
    client.on('close', () => {
      logger.info(`Connection from ${client.remoteAddress}:${client.remotePort} closed`)
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

const callbacks = new Map()

function process (client) {
  let buffer = Buffer.alloc(0)
  return (data) => {
    logger.debug(`Transfer server receiving data ${data}`)
    buffer = Buffer.concat([buffer, data])
    const pos = buffer.indexOf('\n')

    if (buffer[0] === 48 && buffer[1] === 10) {
      const pos1 = buffer.indexOf('\n', pos + 1)
      if (pos1 === -1) {
        logger.info('Received incomplete payload')
        return
      }
      const id = Buffer.slice(pos + 1, pos1 + 1).toString('ascii')
      if (callbacks.has(id)) {
        callbacks.get(id)()
      } else {
        logger.error(`Tramsmit id no callback: ${id}`)
      }
      buffer = buffer.slice(pos1 + 1)
    } else if (buffer[0] === 49 && buffer[1] === 10) {
      /* Offline transfer upload */
      const pos1 = buffer.indexOf('\n', 2)
      if (pos1 === -1) return
      const pos2 = buffer.indexOf('\n', pos1 + 1)
      if (pos2 === -1) return
      const transferKey = buffer.slice(2, pos1).toString()
      const size = parseInt(buffer.slice(pos1 + 1, pos2))
      OfflineTransferModel.findOne({ transferKey })
        .then(offlineTransfer => {
          if (offlineTransfer === null) {
            client.write('rej')
            return
          }
          logger.debug(offlineTransfer)
          const path = `${config.offlineDir}/${transferKey}`
          OfflineTransferModel.updateOne({ _id: offlineTransfer._id }, { $set: { path } })
            .then(() => {
              client.removeAllListeners('data')
              client.write('ok')
              const writeStream = createWriteStream(path)
              writeStream.on('error', async err => {
                logger.error(`Error occurs when receiving offline transfer file. ${err}`)
                await OfflineTransferModel.deleteOne({ _id: offlineTransfer._id })
                client.end()
              })
              client.pipe(writeStream)
              let received = 0
              client.on('data', data => { received += data.length })
              writeStream.on('close', () => {
                if (received === size) {
                  logger.debug(`Received offline transfer ${offlineTransfer._id} file`)
                  OfflineTransferModel.updateOne({ _id: offlineTransfer._id }, { $set: { status: 1 } })
                    .then(() => {
                      request.sendOfflineTransfersByUserId(offlineTransfer.toUserId)
                    })
                } else {
                  logger.debug(`Offline transfer ${offlineTransfer._id} file is not completed`)
                  OfflineTransferModel.deleteOne({ _id: offlineTransfer._id }).then(() => {})
                }
              })
            })
        })
    } else if (buffer[0] === 50 && buffer[1] === 10) {
      /* Offline transfer download */
      const pos = buffer.indexOf('\n', 2)
      if (pos === -1) return
      const transferKey = buffer.slice(2, pos).toString()
      OfflineTransferModel.findOne({ transferKey })
        .then(offlineTransfer => {
          if (offlineTransfer === null) {
            client.write('rej')
            return
          }
          client.removeAllListeners('data')
          const readStream = createReadStream(offlineTransfer.path)
          readStream.on('error', async err => {
            logger.error(`Error occurs when pushing offline transfer file. ${err}`)
            client.end()
          })
          readStream.pipe(client)
          client.on('close', () => {
            logger.info(`Offline transfer ${offlineTransfer._id} file sent or failed`)
          })
        })
    } else {
      buffer = buffer.slice(pos + 1)
    }
  }
}

module.exports = {
  startTransferServer
}
