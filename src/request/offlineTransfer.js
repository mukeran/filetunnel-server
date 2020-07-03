const { SessionModel } = require('../model/session')
const { OfflineTransferModel } = require('../model/offlineTransfer')
const { sendRequest } = require('../connection/payload')
const { logger } = require('../logger')
const { get } = require('../connection/clients')
function sendOfflineTransfers (client) {
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) return
      OfflineTransferModel.find({ toUserId: session.userId })
        .then(async offlineTransferRequests => {
          const requests = []
          for (const index in offlineTransferRequests) {
            await OfflineTransferModel.findOne({ _id: offlineTransferRequests[index]._id })
              .then(TransferRecord => {
                requests.push({
                  _id: TransferRecord._id,
                  filename: TransferRecord.filename,
                  sha1: TransferRecord.sha1,
                  size: TransferRecord.size,
                  fromUserId: TransferRecord.fromUserId,
                  toUserId: TransferRecord.toUserId,
                  time: TransferRecord.time,
                  deadline: TransferRecord.deadline,
                  signature: TransferRecord.signature,
                  encryptedKey: TransferRecord.encryptedKey
                })
              })
          }
          sendRequest({
            action: 'sendOfflineTransfers',
            data: { offlineTransfer: requests }
          }, client)
        })
    })
    .catch(err => {
      logger.error(err)
    })
}

function sendOfflineTransfersByUserId (userId) {
  OfflineTransferModel.find({ toUserId: userId })
    .then(async offlineTransferRequests => {
      const requests = []
      for (const index in offlineTransferRequests) {
        await OfflineTransferModel.findOne({ _id: offlineTransferRequests[index]._id })
          .then(TransferRecord => {
            requests.push({
              _id: TransferRecord._id,
              filename: TransferRecord.filename,
              sha1: TransferRecord.sha1,
              size: TransferRecord.size,
              fromUserId: TransferRecord.fromUserId,
              toUserId: TransferRecord.toUserId,
              time: TransferRecord.time,
              deadline: TransferRecord.deadline,
              signature: TransferRecord.signature,
              encryptedKey: TransferRecord.encryptedKey
            })
          })
      }
      SessionModel.findOne({ userId: userId })
        .then((session) => {
          if (session === null) return
          const client = get(session.host, session.controlPort)
          sendRequest({
            action: 'sendOfflineTransfersByUserId',
            data: { offlineTransfer: requests }
          }, client)
        })
    })
}

module.exports = {
  sendOfflineTransfers,
  sendOfflineTransfersByUserId
}
