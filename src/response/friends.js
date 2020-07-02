const FriendsModel = require('../model/friends')
const SessionModel = require('../model/session')
const FriendRequestsModel = require('../model/friendRequests')
const UserModel = require('../model/user')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const mongoose = require('mongoose')

function requestFriendList (packet, client) {
  var uID
  // var usernames = []
  // var lastAliveTime = []
  // var ip = []
  // var transferPort = []
  var friendsData = []
  SessionModel.getUserID('1', '1', function (_err, user) {
    console.log(user)
    if (user != null) uID = user.userID
    console.log('uID:' + uID)
    FriendsModel.findOne({ userID: uID })
      .then(async (data) => {
        console.log('requestFriendList-done')
        console.log('friends: ' + data.friends)
        for (const index in data.friends) {
          const item = data.friends[index]
          const obj = {}
          await UserModel.findOne({ userID: item })
            .then((friendData) => {
              // console.log(friendData)
              if (friendData.username != null) {
                console.log(friendData.username)
                obj._id = mongoose.Types.ObjectId(friendData._id).toString()
              }
              if (friendData._id != null) {
                console.log(friendData._id)
                obj.username = friendData.username
              }
              if (friendData.lastAliveTime != null) {
                console.log(friendData.lastAliveTime)
                obj.lastSeen = friendData.lastAliveTime.toISOString()
              }
              // friendsData.push(obj)
            })
          obj.isNAT = false
          obj.isOnline = false
          await SessionModel.findOne({ userID: item })
            .then((friendData) => {
              // console.log(friendData)
              if (friendData.ip != null) {
                console.log(friendData.ip)
                obj.ip = friendData.ip
              }
              if (friendData.transferPort != null) {
                console.log(friendData.transferPort)
                obj.port = friendData.transferPort
              }
              obj.isOnline = true
            })
            .catch((err) => {
              console.log('err in session:' + err)
            })
          friendsData.push(obj)
          console.log('After: ' + index + ' ' + JSON.stringify(friendsData[index]))
        }
        sendResponse(client, {
          status: status.OK,
          data: {
            friends: friendsData
          }
        }, packet)
      })
      .catch((err) => {
        console.log('requestFriendList-err')
        sendResponse(client, {
          status: status.UNKNOWN_ERROR,
          errcode: err.code
        }, packet)
      })
  })
}

async function sendFriendRequest (packet, client) {
  const { username } = packet.data
  var userID
  await UserModel.findOne({ username: username })
    .then((data) => {
      userID = data._id
      console.log('userID: ' + userID)
      // eslint-disable-next-line eqeqeq
    })
    .catch((err) => {
      console.log('in first err:' + err.errcode)
    })
  var uID
  // eslint-disable-next-line eqeqeq
  if (userID != undefined) {
    SessionModel.getUserID('1', '1', async function (_err, user) {
      uID = user.userID
      console.log('myID: ' + uID)
      // eslint-disable-next-line eqeqeq
      console.log('in create')
      await FriendRequestsModel.create({
        fromUserId: uID,
        toUserId: userID
      })
        .then((data) => {
          sendResponse(client, {
            status: status.OK
          }, packet)
        })
        .catch((err) => {
          console.log('request-err')
          sendResponse(client, {
            status: status.UNKNOWN_ERROR,
            errcode: err.code
          }, packet)
        })
    })
  } else {
    sendResponse(client, {
      status: status.UNKNOWN_ERROR,
      info: 'no such a user'
    }, packet)
  }
}

function deleteFriend (packet, client) {
  const { userID } = packet.data
  var newFriends = []
  var uID
  SessionModel.getUserID('1', '1', function (_err, user) {
    uID = user.userID
    FriendsModel.findOne({ userID: uID })
      .then(async (data) => {
        console.log('friends: ' + data.friends)
        console.log('deleteFriend: ' + userID)
        newFriends = data.friends
        console.log('now Friends: ' + newFriends)
        for (const index in data.friends) {
          const item = data.friends[index]
          console.log('friend[' + index + ']=' + item)
          // eslint-disable-next-line eqeqeq
          if (item == userID) {
            await newFriends.splice(index, 1)
            console.log('got it')
          }
        }
        newFriends = newFriends.filter(function (s) {
          return s && s.trim()
        })
        await FriendsModel.updateOne({ userID: uID }, { $set: { friends: newFriends } }, function (_err) {})
        console.log('new Friends: ' + newFriends)
        sendResponse(client, { status: status.OK }, packet)
      })
      .catch((err) => {
        console.log('deleteFriend-err')
        sendResponse(client, {
          status: status.UNKNOWN_ERROR,
          errcode: err.code
        }, packet)
      })
  })
}

function answerFriendRequest (packet, client) {
  const { _id, operation } = packet.data
  console.log('_id: ' + _id)
  console.log('opration:' + operation)
  var userID
  var uID
  SessionModel.getUserID('1', '1', function (_err, user) {
    uID = user.userID
    console.log('myID: ' + uID)
    FriendRequestsModel.findOne({ _id: _id })
      .then(async (data) => {
        console.log('answerFriendRequest: ' + _id)
        userID = data.fromUserId
        // eslint-disable-next-line eqeqeq
        if (data.operation == 'accept') addFriend(userID, client) // 加好友
        // if (data.action == 1) 传文件，暂未处理
        FriendRequestsModel.deleteOne({ _id: _id })
          .then((info) => {
            console.log('success')
          })
          .catch((err) => {
            console.log('delete unsuccess:' + err)
          })
      })
      .catch((_err) => {
        console.log('request-err')
      })
  })
}

function friendTransferRequest (packet, client) {
  const { userID } = packet.data
  console.log('userID: ' + userID)
  var uID
  SessionModel.getUserID('1', '1', async function (_err, user) {
    uID = user.userID
    console.log('myID: ' + uID)
    await FriendRequestsModel.create({
      requestID: uID,
      responseID: userID,
      operation: 0,
      action: 1,
      friendRequestsID: 'asdasdasd'
    })
    FriendRequestsModel.updateOne({ friendRequestsID: 'asdasdasd' }, { $set: { friendRequestsID: mongoose.Types.ObjectId(this._id).toString() } }, function (_err) {})
  })
}

function addFriend (userID, client) {
  var newFriends = []
  var uID
  SessionModel.getUserID('1', '1', function (_err, user) {
    uID = user.userID
    FriendsModel.findOne({ userID: uID })
      .then(async (data) => {
        console.log('friends: ' + data.friends)
        console.log('friendRequest: ' + userID)
        newFriends = data.friends
        console.log('now Friends: ' + newFriends)
        for (const index in data.friends) {
          const item = data.friends[index]
          console.log('friend[' + index + ']=' + item)
          // eslint-disable-next-line eqeqeq
          if (item == userID) {
            await newFriends.splice(index, 1)
            console.log('got it')
          }
        }
        await newFriends.push(userID)
        newFriends = newFriends.filter(function (s) {
          return s && s.trim()
        })
        await FriendsModel.updateOne({ userID: uID }, { $set: { friends: newFriends } }, function (_err) {})
        console.log('new Friends: ' + newFriends)
      })
      .catch((_err) => {
        console.log('friendRequest-err')
      })
  })
}
module.exports = {
  requestFriendList,
  sendFriendRequest,
  deleteFriend,
  answerFriendRequest,
  friendTransferRequest,
  addFriend
}
