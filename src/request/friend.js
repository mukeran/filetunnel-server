
const { SessionModel } = require('../model/session')
const { FriendRequestsModel } = require('../model/friendRequests')
const { UserModel } = require('../model/user')
const { sendRequest } = require('../connection/payload')
const { logger } = require('../logger')

function sendFriendRequests (client) {
  SessionModel.getUserID(client.remoteAddress, client.remotePort, function (err, session) {
    if (err) {
      logger.error(err)
      return
    }
    if (session === null) return
    FriendRequestsModel.find({ toUserId: session.userId })
      .then(async friendRequests => {
        const requests = []
        for (const index in friendRequests) {
          await UserModel.findOne({ _id: friendRequests[index].fromUserId })
            .then(user => {
              requests.push({
                _id: friendRequests[index]._id,
                fromUserId: friendRequests[index].fromUserId,
                fromUsername: user.username
              })
            })
        }
        sendRequest({
          action: 'sendFriendRequests',
          data: { friendRequests: requests }
        }, client)
      })
      .catch(err => {
        logger.error(err)
      })
  })
}

module.exports = {
  sendFriendRequests
}
