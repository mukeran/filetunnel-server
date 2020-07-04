const { callbacks } = require('../request/transmit')
const { SessionModel } = require('../model/session')
const { sendResponse } = require('../connection/payload')
const { logger } = require('../logger')
const { sendTransmit, getUniqueId } = require('../request/transmit')
const status = require('../status')

function requestTransmit (packet, client) {
  const { _id } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { _id: '' }, packet)
        return
      }
      const fromUid = session.userId
      logger.debug(`requestTransmit packet: ${JSON.stringify(packet)}`)
      const toUid = _id
      const transmitId = getUniqueId()
      callbacks.set(transmitId, async (fromSocket) => {
        logger.debug(`register send Transmit data for id: ${transmitId}`)
        sendTransmit(fromSocket, toUid, transmitId, fromUid)
      })
      sendResponse(client, { status: status.OK, data: { _id: transmitId } }, packet)
    })
    .catch(err => {
      sendResponse(client, { _id: '' }, packet)
      logger.info(err)
    })
}

module.exports = { requestTransmit }
