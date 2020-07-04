/**
 * Payload and response
 */
const { logger } = require('../logger')
const config = require('../config')
const callback = require('./callback')

/**
 * Package packet into payload
 * @param {Object} packet Packet to send
 * @returns {Buffer} Packaged payload
 */
function createPayload (packet) {
  const data = Buffer.from(JSON.stringify(packet))
  return Buffer.concat([Buffer.from(data.length.toString()), Buffer.from('\n'), data]) // Add data.length info
}

/**
 * Send response to client
 * @param {Socket} client Client socket instance
 * @param {Object} packet Packet to response
 * @param {Object} reqPacket Request packet
 */
function sendResponse (client, packet, reqPacket) {
  return new Promise(resolve => {
    const payload = createPayload({ ...packet, sq: reqPacket.sq })
    logger.debug(`Ready to send payload ${payload}`)
    client.write(payload, () => {
      logger.debug(`Sent payload ${payload}`)
      resolve()
    })
  })
}

/**
 * Send action request to client
 */
function sendRequest (packet, client, timeout = config.connection.RESPONSE_TIMEOUT) {
  return new Promise((resolve, reject) => {
    if (typeof client === 'undefined') {
      logger.error('Send request to undefined client')
      return
    }
    /* Register resolve callback and add sq to packet */
    const sq = callback.register(resolve)
    packet = { ...packet, sq }
    const payload = createPayload(packet)
    logger.debug(`Sending payload ${payload}`)
    /* Send payload */
    client.write(payload, () => setTimeout(() => {
      /* Report timeout when not receiving response after a specific timeout */
      callback.del(sq)
      reject(new Error('Response timeout'))
    }, timeout))
  })
}

module.exports = {
  sendResponse,
  sendRequest
}
