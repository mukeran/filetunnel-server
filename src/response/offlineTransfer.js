const { OfflineTransferModel } = require('../model/offlineTransfer')
const { SessionModel } = require('../model/session')
const { UserModel } = require('../model/user')
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
        .then(async offlineTransfers => {
          if (offlineTransfers === null) offlineTransfers = []
          const record = []
          await Promise.all(offlineTransfers.map(offlineTransfer => {
            if (offlineTransfer.deadline.getTime() < new Date().getTime()) {
              OfflineTransferModel.deleteOne({ _id: offlineTransfer._id })
                .then(offlineTransferRequest => {
                  console.log('Offline transfer request: ' + offlineTransferRequest._id + ' is out of date')
                })
              return
            }
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
          if (transferRequest.deadline.getTime() < new Date().getTime()) {
            OfflineTransferModel.deleteOne({ _id: transferRequest._id })
              .then(offlineTransferRequest => {
                console.log('Offline transfer request: ' + offlineTransferRequest._id + ' is out of date')
                sendResponse(client, { status: status.NOT_FOUND }, packet)
              })
            return
          }
          if (transferRequest.toUserId !== session.userId) {
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
            return
          }
          if (operation === 'accept') {
            OfflineTransferModel.findOne({ _id: transferRequest._id })
              .then(offlineTransfer => {
                if (offlineTransfer.status === 1 || offlineTransfer.status === 2) {
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
