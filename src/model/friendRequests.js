const mongoose = require('mongoose')
const db = require('../database')

const FriendRequestsSchema = new mongoose.Schema({
  fromUserId: { type: String }, // Requester user id
  toUserId: { type: String } // Receiver user id
})

const FriendRequestsModel = db.model('friendRequests', FriendRequestsSchema)

module.exports = { FriendRequestsModel }
