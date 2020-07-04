/**
 * Server functions
 */
const { createServer } = require('net')
const { logger } = require('./logger')
const { dispatch } = require('./response')
const clients = require('./connection/clients')
const callback = require('./connection/callback')
const { callbacks } = require('./request/transmit')

/**
 * Process data received from client
 * @param {Buffer} data Data received
 * @param {Socket} client Client socket instance
 */
function processData (client) {
  let buffer = Buffer.alloc(0)
  return (data) => {
    /* Concat to existed buffer */
    logger.debug(`Receiving data ${data}`)
    /* Concat to existed buffer */
    buffer = Buffer.concat([buffer, data])
    /* Find the end symbol of size (LF) */
    const pos = buffer.indexOf('\n')
    if (pos === -1) {
      logger.info('Received incomplete payload')
      return
    }
    /* Get the size of payload */
    const size = parseInt(buffer.slice(0, pos).toString())
    if (size <= 1) {
      logger.error(`Wrong payload size: ${size}`)
      return
    }
    /* Check if received incomplete payload */
    if (buffer.length < size + pos + 1) {
      logger.info('Received incomplete payload')
      return
    }
    /* Convert JSON to Object. Detect parse error */
    let packet
    try {
      packet = JSON.parse(buffer.slice(pos + 1, size + pos + 1).toString())
    } catch (e) {
      logger.error('Invalid JSON format')
    } finally {
      buffer = buffer.slice(size + pos + 1)
    }
    if (typeof packet.action !== 'undefined') {
      /* Do server action when action exists in packet */
      dispatch(packet, client)
    } else if (typeof packet.sq !== 'undefined') {
      /* Undefined request indicates that the packet is a response */
      const cb = callback.get(packet.sq) // Get resolve callback from pool
      if (typeof callback !== 'undefined') {
        callback.del(packet.sq) // Delete callback when succeeded
        cb(packet) // Call callback
        logger.info(`Received packet ${packet.sq} response`)
      } else {
        /* If there's no recorded callback, it is timeout or fake */
        logger.info(`Received invalid packet ${packet.sq}`)
      }
    } else {
      logger.error('Invalid packet format')
    }
  }
}

/**
 * Start listening server
 * @param {string} host Host to listen
 * @param {number} port Port to listen
 */
function startServer (host, port) {
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
    client.on('data', processData(client))
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

/**
 * Start Date listening server
 * @param {string} host Host to listen
 * @param {number} port Port to listen
 */
function startDataServer (host, port) {
  logger.info(`Server starting on ${host}:${port}...`)
  const server = createServer()
  /* Event server started */
  server.on('listening', () => {
    logger.info('Server started')
  })
  /* Connection received */
  server.on('connection', (client) => {
    logger.info(`Received transmit connection from ${client.remoteAddress}:${client.remotePort}`)
    clients.register(client.remoteAddress, client.remotePort, client)
    client.on('data', process(client))
    client.on('close', () => {
      logger.info(`Transmit connection from ${client.remoteAddress}:${client.remotePort} closed`)
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
    logger.debug(`Transmit Receiving data ${data}`)
    buffer = Buffer.concat([buffer, data])
    const pos = buffer.indexOf('\n')

    if (buffer[0] === 48 && buffer[1] === 10) {
      const pos1 = buffer.indexOf('\n', pos + 1)
      if (pos1 === -1) {
        logger.info('Received incomplete payload')
        return
      }
      const id = buffer.slice(pos + 1, pos1).toString('ascii')
      if (callbacks.has(id)) {
        logger.debug(`call callback of ${id}`)
        const cb = callbacks.get(id)
        cb(client).catch(() => { logger.error(err) })
        callbacks.delete(id)
      } else {
        logger.error(`Tramsmit id no callback: ${id}`)
      }
      buffer = buffer.slice(pos1 + 1)
    } else if (buffer[0] === 49 && buffer[1] === 10) {
      buffer = buffer.slice(pos + 1)
    } else {
      buffer = buffer.slice(pos + 1)
    }
  }
}

module.exports = {
  startServer,
  startDataServer
}
