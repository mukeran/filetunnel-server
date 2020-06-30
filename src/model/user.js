const mongoose = require('mongoose')
const db = require('../database')

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  salt: { type: String, required: true }
})

UserSchema.statics.getPasswordHash = function (password, salt) {
  const crypto = require('crypto')
  const md5 = crypto.createHash('md5')
  const sha1 = crypto.createHash('sha1')
  return sha1.update(salt + md5.update(password).digest('hex')).digest('hex')
}

const UserModel = db.model('User', UserSchema)

module.exports = UserModel
