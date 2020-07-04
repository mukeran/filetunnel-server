const { OfflineTransferModel } = require('../model/offlineTransfer')
const { SessionModel } = require('../model/session')
const crypto = require('crypto')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const { logger } = require('../logger')

function requestOfflineTransfer (packet, client) {
  const { userId, filename, size, sha1, deadline, encryptedKey, signature } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
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

function queryOfflineTransfers (packet, client) {
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(fromUserSession => {
      if (fromUserSession === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      OfflineTransferModel.find({ fromUserId: fromUserSession.userId })
        .then(offlineTransfers => {
          if (offlineTransfers === null) offlineTransfers = []
          const record = []
          offlineTransfers.forEach((offlineTransfer) => {
            logger.debug(offlineTransfer)
            record.push({
              _id: offlineTransfer._id,
              filename: offlineTransfer.filename,
              sha1: offlineTransfer.sha1,
              toUserId: offlineTransfer.toUserId,
              status: offlineTransfer.status,
              time: offlineTransfer.time.toISOString(),
              deadline: offlineTransfer.deadline.toISOString()
            })
          })
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

function answerOfflineTransfer (packet, client) {
  const { _id, operation } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      OfflineTransferModel.findOne({ _id })
        .then(transferRequest => {
          if (transferRequest === null) {
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
            return
          }
          if (transferRequest.toUserId !== session.userId) {
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
            return
          }
          if (operation === 'accept') {
            const transferKey = crypto.randomBytes(16).toString('hex')
            OfflineTransferModel.updateOne({ _id: transferRequest._id }, { $set: { status: 2, transferKey: transferKey } })
              .then(() => {
                /* File operation */
                sendResponse(client, { status: status.OK, data: { transferKey: transferKey } }, packet)
              })
          } else if (operation === 'deny') {
            OfflineTransferModel.updateOne({ _id: transferRequest._id }, { $set: { status: 3 } })
              .then(() => {
                /* File operation */
                sendResponse(client, { status: status.OK }, packet)
              })
          } else if (operation === 'invalid_sign') {
          } else {
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
