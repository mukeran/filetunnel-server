const mongoose = require('mongoose')
const db = require('../database')

const UserSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  salt: { type: String, required: true },
  publicKey: { type: String, required: true },
  lastAliveTime: { type: Date, default: Date.now },
  online: { type: Boolean }
})
const SessionSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  sessionID: { type: String, required: true },
  ip: { type: String, required: true },
  controlPort: { type: Number, required: true },
  transferPort: { type: Number, required: true }
})

UserSchema.statics.getPasswordHash = function (password, salt) {
  const crypto = require('crypto')
  const md5 = crypto.createHash('md5')
  const sha1 = crypto.createHash('sha1')
  return sha1.update(salt + md5.update(password).digest('hex')).digest('hex')
}

const UserModel = db.model('User', UserSchema)
const SessionModel = db.model('Session', SessionSchema)
module.exports = { UserModel, SessionModel }
