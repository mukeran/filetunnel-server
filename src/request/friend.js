
const { SessionModel } = require('../model/session')
const { FriendRequestsModel } = require('../model/friendRequests')
const { UserModel } = require('../model/user')
const { sendRequest } = require('../connection/payload')
const { logger } = require('../logger')

/**
 * Send friend requests to client
 * @param {Socket} client Client socket instance
 */
function sendFriendRequests (client) {
  SessionModel.getUserID(client.remoteAddress, client.remotePort, function (err, session) { // Get userId
    if (err) {
      logger.error(err)
      return
    }
    if (session === null) return // In case user is not online
    FriendRequestsModel.find({ toUserId: session.userId }) // Retrieve only the request whose receiver is the request
      .then(async friendRequests => {
        const requests = []
        for (const index in friendRequests) { // Traverse the friendRequests
          await UserModel.findOne({ _id: friendRequests[index].fromUserId }) // Get user information
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
