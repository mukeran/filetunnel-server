const mongoose = require('mongoose')
const db = require('../database')

const FriendRequestsSchema = new mongoose.Schema({
  fromUserId: { type: String },
  toUserId: { type: String }
})

const FriendRequestsModel = db.model('friendrequests', FriendRequestsSchema)

module.exports = FriendRequestsModel
