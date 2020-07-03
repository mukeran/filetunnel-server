const mongoose = require('mongoose')
const db = require('../database')

const OfflineTransferSchema = new mongoose.Schema({
  fromUserId: { type: String },
  toUserId: { type: String },
  status: { type: Number },
  transferKey: { type: String },
  filename: { type: String },
  size: { type: Number },
  sha1: { type: String },
  encryptedKey: { type: String },
  path: { type: String },
  time: { type: Date, default: Date.now },
  deadline: { type: Date }
})

/**
 * status:
 * 0: UPLOADING,
 * 1: PENDING,
 * 2: ACCEPTED,
 * 3: DENIED,
 * 4: INVALID_SIGN
 */

const OfflineTransferModel = db.model('offlineTransfer', OfflineTransferSchema)

module.exports = { OfflineTransferModel }
