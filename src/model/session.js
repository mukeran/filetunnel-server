const mongoose = require('mongoose')
const db = require('../database')

// 会话列表
const SessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Session对应的用户
  sessionId: { type: String, required: true },
  ip: { type: String, required: true }, // 用户IP
  controlPort: { type: String, required: true }, // 连接服务器控制信息端口
  transferPort: String, // 文件传输用端口
  isNAT: { type: Boolean, default: false }
})

/**
 *get UserId by session
 * @param {String} ip // 远程ip
 * @param {number} port //远程端口
 */
SessionSchema.statics.getByIpPort = function (ip, port) {
  return this.findOne({ ip: ip, controlPort: port })
} // 通过session判断用户

const SessionModel = db.model('session', SessionSchema)

module.exports = { SessionModel }
