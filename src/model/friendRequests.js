const mongoose = require('mongoose')
const db = require('../database')

const FriendRequestsSchema = new mongoose.Schema({
  fromUserId: { type: String },
  toUserId: { type: String }
})

const FriendRequestsModel = db.model('friendRequests', FriendRequestsSchema)

module.exports = { FriendRequestsModel }
