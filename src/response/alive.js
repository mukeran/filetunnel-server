/**
 * Alive packet
 */
const { sendResponse } = require('../connection/payload')
const status = require('../status')

function alive (packet, client) {
  sendResponse(client, { status: status.OK }, packet)
}
module.exports = {
  alive
}
