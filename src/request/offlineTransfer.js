const { SessionModel } = require('../model/session')
const { OfflineTransferModel } = require('../model/offlineTransfer')
const { sendRequest } = require('../connection/payload')
const { logger } = require('../logger')

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
                  toUserId: TransferRecord.toUserId,
                  time: TransferRecord.time,
                  deadline: TransferRecord.deadline
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

module.exports = {
  sendOfflineTransfers
}
