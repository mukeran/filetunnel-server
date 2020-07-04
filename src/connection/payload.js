/**
 * Payload and response
 */
const { logger } = require('../logger')
const config = require('../config')
const callback = require('./callback')

/**
 * Package packet into payload
 * @param {Object} packet Packet to send
 * @returns {string} Packaged payload
 */
function createPayload (packet) {
  const data = JSON.stringify(packet)
  return data.length + '\n' + data
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
    /* Register resolve callback and add sq to packet */
    const sq = callback.register(resolve)
    logger.debug(sq)
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
