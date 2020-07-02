const mongoose = require('mongoose')
const db = require('../database')

const FriendsSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  friends: { type: [String], required: true }
})

const FriendsModel = db.model('friends', FriendsSchema)

module.exports = FriendsModel
