const { SessionModel } = require('../model/session')
const { FriendRequestsModel } = require('../model/friendRequests')
const { UserModel } = require('../model/user')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const mongoose = require('mongoose')
const { logger } = require('../logger')
const clients = require('../connection/clients')
const request = require('../request')

/**
 * Process the friend list request from client
 * @param {Object} packet Received packet
 * @param {Socket} client Client socket instance
 */
function requestFriendList (packet, client) {
  SessionModel.getUserID(client.remoteAddress, client.remotePort, function (err, session) { // Get UserId by client ip and control port
    if (err) {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      return
    }
    if (session === null) { // In case user is not online
      sendResponse(client, { status: status.ACCESS_DENIED }, packet)
      return
    }
    UserModel.findOne({ _id: session.userId })
      .then(async (data) => {
        if (data === null) { // If user has no friends
          sendResponse(client, { status: status.OK, data: { friends: [] } }, packet)
          return
        }
        const friends = []
        for (const index in data.friends) {
          const friendId = data.friends[index]
          const friend = {}
          let isNotFound = false
          await UserModel.findOne({ _id: friendId }) // Get user info
            .then(user => {
              friend._id = mongoose.Types.ObjectId(user._id).toString()
              friend.username = user.username
              friend.lastSeen = user.lastAliveTime.toISOString()
            })
            .catch(err => {
              logger.error(err)
              isNotFound = true
            })
          if (isNotFound) continue // If no such a user or account has been canceled
          friend.isNAT = false
          friend.isOnline = false
          /* Get user ip and port If user is online */
          await SessionModel.findOne({ userId: friendId })
            .then(session => {
              if (session !== null) {
                friend.ip = session.ip
                friend.port = session.transferPort
                friend.isOnline = true
              }
            })
            .catch((err) => {
              logger.error(err)
            })
          friends.push(friend)
        }
        sendResponse(client, {
          status: status.OK,
          data: { friends }
        }, packet)
      })
      .catch((err) => {
        logger.error(err)
        sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      })
  })
}

/**
 * Process friend request from client
 * @param {Object} packet Received packet
 * @param {Socket} client Client socket instance
 */
function sendFriendRequest (packet, client) {
  const { username } = packet.data
  UserModel.findOne({ username: username }) // Get userId from username
    .then(toUser => {
      if (toUser === null) { // if no such a user
        sendResponse(client, { status: status.user.NO_SUCH_USER }, packet)
        return
      }
      /* Get UserId by client ip and control port */
      SessionModel.getUserID(client.remoteAddress, client.remotePort, function (err, fromUserSession) {
        if (err) {
          logger.error(err)
          sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          return
        }
        FriendRequestsModel.create({ // Create a nuw friend request
          fromUserId: fromUserSession.userId,
          toUserId: toUser._id
        })
          .then(() => {
            sendResponse(client, { status: status.OK }, packet)
            /* Send a friend request message to targer user if the user is online */
            SessionModel.findOne({ userId: toUser._id })
              .then(session => {
                if (session !== null) {
                  const toClient = clients.get(session.ip, session.controlPort)
                  request.sendFriendRequests(toClient)
                }
              })
          })
          .catch(err => {
            logger.error(err)
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          })
      })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

/**
 * Process a delete friend request from client
 * @param {Object} packet Received packet
 * @param {Socket} client Client socket instance
 */
function deleteFriend (packet, client) {
  const { userId } = packet.data
  /* Get UserId by client ip and control port */
  SessionModel.getUserID(client.remoteAddress, client.remotePort, function (err, session) {
    if (err) {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      return
    }
    UserModel.findOne({ _id: session.userId }) // Get user's friends
      .then(data => {
        const newFriends = data.friends.filter(friend => friend !== userId) // Delete user-specified friend
        UserModel.updateOne({ _id: session.userId }, { $set: { friends: newFriends } }) // Update user's friends
          .then(() => {
            sendResponse(client, { status: status.OK }, packet)
          })
          .catch(err => {
            logger.error(err)
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          })
      })
      .catch(err => {
        logger.error(err)
        sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      })
  })
}

/**
 * Process an operation of friend request from client
 * @param {Object} packet Received packet
 * @param {Socket} client Client socket instance
 */
function answerFriendRequest (packet, client) {
  const { _id, operation } = packet.data
  /* Get UserId by client ip and control port */
  SessionModel.getUserID(client.remoteAddress, client.remotePort, function (err, session) {
    if (err) {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      return
    }
    if (session === null) { // In case user is not online
      sendResponse(client, { status: status.ACCESS_DENIED }, packet)
      return
    }
    /* Find the friend request */
    FriendRequestsModel.findOne({ _id })
      .then(friendRequest => {
        if (friendRequest === null) {
          sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          return
        }
        if (friendRequest.toUserId !== session.userId) {
          sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          return
        }
        if (operation === 'accept') {
          /* Add friend */
          UserModel.findOne({ _id: friendRequest.toUserId })
            .then(data => {
              /* Determine if target user is already user'sfriend */
              if (!data.friends.some(friend => friend === friendRequest.fromUserId)) {
                /* Add friends in both directions */
                data.friends.push(friendRequest.fromUserId)
                UserModel.updateOne({ _id: friendRequest.toUserId }, { $set: { friends: data.friends } })
                  .then(() => {
                    UserModel.findOne({ _id: friendRequest.fromUserId })
                      .then(data => {
                        if (!data.friends.some(friend => friend === friendRequest.toUserId)) {
                          data.friends.push(friendRequest.toUserId)
                          UserModel.updateOne({ _id: friendRequest.fromUserId }, { $set: { friends: data.friends } })
                            .then(() => {
                              sendResponse(client, { status: status.OK }, packet)
                            })
                            .catch(err => {
                              logger.error(err)
                              sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
                            })
                        }
                      })
                  })
                  .catch(err => {
                    logger.error(err)
                    sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
                  })
              }
            })
            .catch(err => {
              logger.error(err)
              sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
            })
        }
        /* Delete the handled friend request */
        FriendRequestsModel.deleteOne(friendRequest)
          .then(() => {
            logger.debug(`Successfully deleted friendRequest ${_id}`)
          })
          .catch(err => {
            logger.debug(`Failed to delete friendRequest ${_id}. ${err}`)
          })
      })
      .catch(err => {
        logger.error(err)
        sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      })
  })
}

module.exports = {
  requestFriendList,
  sendFriendRequest,
  deleteFriend,
  answerFriendRequest
}
