const { SessionModel } = require('../model/session')
const { FriendRequestsModel } = require('../model/friendRequests')
const { UserModel } = require('../model/user')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const mongoose = require('mongoose')
const { logger } = require('../logger')
const clients = require('../connection/clients')
const request = require('../request')
const config = require('../config')

function requestFriendList (packet, client) {
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      UserModel.findOne({ _id: session.userId })
        .then(async (data) => {
          if (data === null) {
            sendResponse(client, { status: status.OK, data: { friends: [] } }, packet)
            return
          }
          const friends = []
          for (const index in data.friends) {
            const friendId = data.friends[index]
            const friend = {
              isOnline: false
            }
            let isNotFound = false
            await UserModel.findOne({ _id: friendId })
              .then(user => {
                if (user === null) {
                  isNotFound = true
                  return
                }
                friend._id = mongoose.Types.ObjectId(user._id).toString()
                friend.username = user.username
                friend.lastSeen = user.lastAliveTime.toISOString()
              })
            if (isNotFound) continue
            await SessionModel.findOne({ userId: friendId })
              .then(session => {
                if (session !== null) {
                  friend.ip = session.ip
                  friend.port = session.transferPort
                  friend.isNAT = session.isNAT
                  if (new Date().getTime() <= new Date(friend.lastSeen).getTime() + 3 * config.connection.ALIVE_PERIOD) {
                    friend.isOnline = true
                  }
                }
              })
            friends.push(friend)
          }
          sendResponse(client, {
            status: status.OK,
            data: { friends }
          }, packet)
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

function sendFriendRequest (packet, client) {
  const { username } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(fromUserSession => {
      if (fromUserSession === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      UserModel.findOne({ username: username })
        .then(toUser => {
          if (toUser === null) {
            sendResponse(client, { status: status.user.NO_SUCH_USER }, packet)
            return
          }
          if (fromUserSession.userId === toUser._id.toString()) {
            sendResponse(client, { status: status.user.CANNOT_OPERATE_SELF }, packet)
            return
          }
          UserModel.findOne({ _id: fromUserSession.userId })
            .then(fromUser => {
              if (fromUser.friends.indexOf(toUser._id.toString()) !== -1) {
                sendResponse(client, { status: status.user.ALREADY_FRIEND }, packet)
                return
              }
              FriendRequestsModel.findOne({
                fromUserId: fromUserSession.userId,
                toUserId: toUser._id
              })
                .then(result => {
                  if (result !== null) {
                    sendResponse(client, { status: status.user.FRIEND_REQUEST_EXISTED }, packet)
                    return
                  }
                  FriendRequestsModel.create({
                    fromUserId: fromUserSession.userId,
                    toUserId: toUser._id
                  })
                    .then(() => {
                      sendResponse(client, { status: status.OK }, packet)
                      SessionModel.findOne({ userId: toUser._id })
                        .then(session => {
                          if (session !== null) {
                            const toClient = clients.get(session.ip, session.controlPort)
                            request.sendFriendRequests(toClient)
                          }
                        })
                    })
                })
            })
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

function deleteFriend (packet, client) {
  const { userId } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      const p1 = UserModel.findOne({ _id: session.userId })
        .then(data => {
          const newFriends = data.friends.filter(friend => friend !== userId)
          return UserModel.updateOne({ _id: session.userId }, { $set: { friends: newFriends } })
        })
      const p2 = UserModel.findOne({ _id: userId })
        .then(data => {
          const newFriends = data.friends.filter(friend => friend !== session.userId)
          return UserModel.updateOne({ _id: userId }, { $set: { friends: newFriends } })
        })
      Promise.all([p1, p2])
        .then(() => {
          sendResponse(client, { status: status.OK }, packet)
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

function answerFriendRequest (packet, client) {
  const { _id, operation } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
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
            UserModel.findOne({ _id: friendRequest.toUserId })
              .then(data => {
                if (!data.friends.some(friend => friend === friendRequest.fromUserId)) {
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
                          }
                        })
                    })
                }
              })
          }
          FriendRequestsModel.deleteOne(friendRequest)
            .then(() => {
              logger.debug(`Successfully deleted friendRequest ${_id}`)
            })
            .catch(err => {
              logger.debug(`Failed to delete friendRequest ${_id}. ${err}`)
            })
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

module.exports = {
  requestFriendList,
  sendFriendRequest,
  deleteFriend,
  answerFriendRequest
}
