/**
 * Alive packet
 */
const { sendResponse } = require('../connection/payload')
const status = require('../status')

module.exports = (packet, client) => {
  sendResponse(client, { status: status.OK }, packet)
}
