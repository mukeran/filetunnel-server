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
              isNAT: false,
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
      UserModel.findOne({ _id: session.userId })
        .then(data => {
          const newFriends = data.friends.filter(friend => friend !== userId)
          UserModel.updateOne({ _id: session.userId }, { $set: { friends: newFriends } })
            .then(() => {
              sendResponse(client, { status: status.OK }, packet)
            })
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
