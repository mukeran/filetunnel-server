/**
 * Alive packet
 */
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const { SessionModel } = require('../model/session')
const { UserModel } = require('../model/user')
const { logger } = require('../logger')

function alive (packet, client) {
  sendResponse(client, { status: status.OK }, packet)
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) return
      UserModel.updateOne({ _id: session.userId }, { $set: { lastAliveTime: new Date() } })
        .then(() => {
          logger.debug(`Successfully updated ${session.userId}'s lastAliveTime`)
        })
    })
    .catch(err => {
      logger.error(err)
      logger.error('Failed to update lastAliveTime')
    })
}
module.exports = {
  alive
}
