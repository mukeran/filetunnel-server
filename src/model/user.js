const mongoose = require('mongoose')
const db = require('../database')

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  salt: { type: String, required: true }, // 加密password用
  publicKey: { type: String, required: true },
  lastAliveTime: { type: Date, default: Date.now },
  friends: { type: [String], required: true }
})

/**
 *Get salted hash of password
 * @param {String} password
 * @param {String} salt
 */
UserSchema.statics.getPasswordHash = function (password, salt) {
  const crypto = require('crypto')
  const md5 = crypto.createHash('md5')
  const sha1 = crypto.createHash('sha1')
  return sha1.update(salt + md5.update(password).digest('hex')).digest('hex')
} // 获取MD5值函数

const UserModel = db.model('user', UserSchema)
module.exports = { UserModel }
