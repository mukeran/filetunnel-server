/**
 * Alive packet
 */
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const request = require('../request')

function alive (packet, client) {
  sendResponse(client, { status: status.OK }, packet)
  console.log(Object.keys(request))
  request.sendFriendRequests(packet, client)
}
module.exports = {
  alive
}
