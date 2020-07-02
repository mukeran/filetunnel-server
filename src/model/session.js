const mongoose = require('mongoose')
const db = require('../database')

const SessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  ip: { type: String, required: true },
  controlPort: { type: String, required: true },
  transferPort: { type: String, required: true }
})

SessionSchema.statics.getUserID = function (ip, port, cb) {
  this.findOne({ ip: ip, controlPort: port }, cb)
}

const SessionModel = db.model('session', SessionSchema)

module.exports = { SessionModel }
