const { SessionModel } = require('../model/session')
const { OfflineTransferModel } = require('../model/offlineTransfer')
const { UserModel } = require('../model/user')
const { sendRequest } = require('../connection/payload')
const { logger } = require('../logger')
const { get } = require('../connection/clients')

/**
 * Send offline transfer requests to client
 * @param {Socket} client Client socket
 */
function sendOfflineTransfers (client) {
  /* Get user session */
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) return
      /* Find offline transfer requests to current user */
      OfflineTransferModel.find({ $and: [{ toUserId: session.userId }, { $or: [{ status: 1 }, { status: 2 }] }] })
        .then(async offlineTransfers => {
          const requests = []
          /* Get offline transfer infomation */
          await Promise.all(offlineTransfers.map(offlineTransfer => {
            /* Check for expiration */
            if (offlineTransfer.deadline.getTime() < new Date().getTime()) {
              OfflineTransferModel.deleteOne({ _id: offlineTransfer._id })
                .then(() => {
                  logger.debug(`Deleted expired offline transfer ${offlineTransfer._id}`)
                })
              return
            }
            /* Get user infomation in offline transfers */
            return UserModel.findOne({ _id: offlineTransfer.fromUserId })
              .then(user => {
                requests.push({
                  _id: offlineTransfer._id,
                  filename: offlineTransfer.filename,
                  sha1: offlineTransfer.sha1,
                  size: offlineTransfer.size,
                  fromUserId: offlineTransfer.fromUserId,
                  fromUsername: user.username,
                  toUserId: offlineTransfer.toUserId,
                  time: offlineTransfer.time,
                  deadline: offlineTransfer.deadline,
                  signature: offlineTransfer.signature,
                  encryptedKey: offlineTransfer.encryptedKey,
                  status: offlineTransfer.status
                })
              })
          }))
          sendRequest({
            action: 'sendOfflineTransfers',
            data: { offlineTransfers: requests }
          }, client)
        })
    })
    .catch(err => {
      logger.error(err)
    })
}

/**
 * Send offline transfer requests to client
 * @param {Socket} client Client socket
 */
function sendOfflineTransfersByUserId (userId) {
  /* Get user session by id */
  SessionModel.findOne({ userId: userId })
    .then((session) => {
      if (session === null) return
      /* Find offline transfer requests to current user */
      const client = get(session.ip, session.controlPort)
      OfflineTransferModel.find({ $and: [{ toUserId: userId }, { $or: [{ status: 1 }, { status: 2 }] }] })
        .then(async offlineTransfers => {
          const requests = []
          /* Get offline transfer infomation */
          await Promise.all(offlineTransfers.map(offlineTransfer => {
            /* Check for expiration */
            if (offlineTransfer.deadline.getTime() < new Date().getTime()) {
              OfflineTransferModel.deleteOne({ _id: offlineTransfer._id })
                .then(() => {
                  logger.debug(`Deleted expired offline transfer ${offlineTransfer._id}`)
                })
              return
            }
            /* Get user infomation in offline transfers */
            return UserModel.findOne({ _id: offlineTransfer.fromUserId })
              .then(user => {
                requests.push({
                  _id: offlineTransfer._id,
                  filename: offlineTransfer.filename,
                  sha1: offlineTransfer.sha1,
                  size: offlineTransfer.size,
                  fromUserId: offlineTransfer.fromUserId,
                  fromUsername: user.username,
                  toUserId: offlineTransfer.toUserId,
                  time: offlineTransfer.time,
                  deadline: offlineTransfer.deadline,
                  signature: offlineTransfer.signature,
                  encryptedKey: offlineTransfer.encryptedKey,
                  status: offlineTransfer.status
                })
              })
          }))
          sendRequest({
            action: 'sendOfflineTransfers',
            data: { offlineTransfers: requests }
          }, client)
        })
    })
}

module.exports = {
  sendOfflineTransfers,
  sendOfflineTransfersByUserId
}
