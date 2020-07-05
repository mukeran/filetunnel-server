const { OfflineTransferModel } = require('../model/offlineTransfer')
const { SessionModel } = require('../model/session')
const { UserModel } = require('../model/user')
const crypto = require('crypto')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const { logger } = require('../logger')

/**
 * Request offline transfer
 * @param {Object} packet Packet received
 * @param {Socket} client Currnet client socket
 */
function requestOfflineTransfer (packet, client) {
  const { userId, filename, size, sha1, deadline, encryptedKey, signature } = packet.data
  /* Get user session */
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      /* Make sure the user is online */
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      /* Generate random transfer key */
      const transferKey = crypto.randomBytes(16).toString('hex')
      OfflineTransferModel.create({
        fromUserId: session.userId,
        toUserId: userId,
        transferKey,
        filename: filename,
        size: size,
        sha1: sha1,
        status: 0,
        deadline: new Date(deadline),
        encryptedKey: encryptedKey,
        signature: signature
      })
        .then(data => {
          sendResponse(client, { status: status.OK, data: { _id: data._id, transferKey: transferKey } }, packet)
        })
        .catch(err => {
          logger.debug(err)
          sendResponse(client, { status: status.transfer.FAILED }, packet)
        })
    })
}

/**
 * Query oflline transfers
 * @param {Object} packet Packet received
 * @param {Socket} client Current client socket
 */
function queryOfflineTransfers (packet, client) {
  /* Get user session */
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(fromUserSession => {
      /* Make sure the user is online */
      if (fromUserSession === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      /* Find offline transfer */
      OfflineTransferModel.find({ fromUserId: fromUserSession.userId })
        .then(async offlineTransfers => {
          if (offlineTransfers === null) offlineTransfers = []
          const record = []
          await Promise.all(offlineTransfers.map(offlineTransfer => {
            /* Check if the offline file transfer has expired */
            if (offlineTransfer.deadline.getTime() < new Date().getTime()) {
              OfflineTransferModel.deleteOne({ _id: offlineTransfer._id })
                .then(() => {
                  logger.debug(`Deleted expired offline transfer ${offlineTransfer._id}`)
                })
              return
            }
            /* Push requests */
            return UserModel.findOne({ _id: offlineTransfer.toUserId })
              .then(user => {
                record.push({
                  _id: offlineTransfer._id,
                  filename: offlineTransfer.filename,
                  sha1: offlineTransfer.sha1,
                  toUserId: offlineTransfer.toUserId,
                  toUsername: user.username,
                  status: offlineTransfer.status,
                  time: offlineTransfer.time.toISOString(),
                  deadline: offlineTransfer.deadline.toISOString()
                })
              })
          }))
          sendResponse(client, {
            status: status.OK,
            data: { offlineTransfers: record }
          }, packet)
        })
        .catch(err => {
          logger.debug('Err in query：' + err)
          sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
        })
    })
}

/**
 * Answer offline transfer
 * @param {Object} packet Packet received
 * @param {Socket} client Current client socket
 */
function answerOfflineTransfer (packet, client) {
  const { _id, operation } = packet.data
  /* Get user session */
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      /* Make sure the user is online */
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      OfflineTransferModel.findOne({ _id })
        .then(transferRequest => {
          /* Check if there is an offline transfer request */
          if (transferRequest === null) {
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
            return
          }
          /* Check if the offline file transfer has expired */
          if (transferRequest.deadline.getTime() < new Date().getTime()) {
            sendResponse(client, { status: status.NOT_FOUND }, packet)
            OfflineTransferModel.deleteOne({ _id: transferRequest._id })
              .then(() => {
                logger.debug(`Deleted expired offline transfer ${transferRequest._id}`)
              })
            return
          }
          if (transferRequest.toUserId !== session.userId) {
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
            return
          }
          /* Answer the request */
          if (operation === 'accept') {
            OfflineTransferModel.findOne({ _id: transferRequest._id })
              .then(offlineTransfer => {
                /* Check status */
                if (offlineTransfer.status === 1 || offlineTransfer.status === 2) {
                  /* Renew transfer key */
                  const transferKey = crypto.randomBytes(16).toString('hex')
                  OfflineTransferModel.updateOne({ _id: transferRequest._id }, { $set: { status: 2, transferKey: transferKey } })
                    .then(() => {
                      /* File operation */
                      sendResponse(client, { status: status.OK, data: { transferKey: transferKey } }, packet)
                    })
                } else {
                  console.log('Can not accept it')
                  sendResponse(client, { status: status.transfer.DENIED }, packet)
                }
              })
          } else if (operation === 'deny') {
            OfflineTransferModel.findOne({ _id: transferRequest._id })
              .then(offlineTransfer => {
                /* Check status */
                if (offlineTransfer.status === 1) {
                  OfflineTransferModel.updateOne({ _id: transferRequest._id }, { $set: { status: 3 } })
                    .then(() => {
                      /* File operation */
                      sendResponse(client, { status: status.OK }, packet)
                    })
                } else {
                  console.log('Can not deny it')
                  sendResponse(client, { status: status.transfer.DENIED }, packet)
                }
              })
          } else if (operation === 'invalid_sign') {
            OfflineTransferModel.findOne({ _id: transferRequest._id })
              .then(offlineTransfer => {
                /* Check status */
                if (offlineTransfer.status === 1) {
                  OfflineTransferModel.updateOne({ _id: transferRequest._id }, { $set: { status: 4 } })
                    .then(() => {
                      /* File operation */
                      sendResponse(client, { status: status.OK }, packet)
                    })
                } else {
                  console.log('Invalid_sign')
                  sendResponse(client, { status: status.transfer.FAILED }, packet)
                }
              })
          } else {
            logger.debug('Unknown Error')
          }
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

module.exports = {
  requestOfflineTransfer,
  queryOfflineTransfers,
  answerOfflineTransfer
}
