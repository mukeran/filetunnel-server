const mongoose = require('mongoose')
const db = require('../database')

const SessionSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  sessionID: { type: String, required: true },
  ip: { type: String, required: true },
  controlPort: { type: String, required: true },
  transferPort: { type: String, required: true }
})

SessionSchema.statics.getUserID = function (ip, port, cb) {
  console.log('ip:' + ip)
  console.log('port:' + port)
  this.findOne({ ip: ip, controlPort: port }, cb)
}

const SessionModel = db.model('session', SessionSchema)

module.exports = SessionModel
