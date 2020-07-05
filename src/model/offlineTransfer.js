const mongoose = require('mongoose')
const db = require('../database')

const OfflineTransferSchema = new mongoose.Schema({
  fromUserId: { type: String }, // Offline transfer requester user id
  toUserId: { type: String }, // Offline transfer receiver user id
  status: { type: Number }, // Offline transfer status
  transferKey: { type: String }, // Transfer key
  filename: { type: String }, // File name
  size: { type: Number }, // File size
  sha1: { type: String }, // File sha1 check code
  encryptedKey: { type: String }, // Ecvrypted key
  path: { type: String }, // File path
  time: { type: Date, default: Date.now }, // Request time
  deadline: { type: Date }, // Dead line
  signature: { type: String } // File signature
})

/**
 * status:
 * 0: UPLOADING,
 * 1: PENDING,
 * 2: ACCEPTED,
 * 3: REJECTED,
 * 4: INVALID_SIGN
 */

const OfflineTransferModel = db.model('offlineTransfer', OfflineTransferSchema)

module.exports = { OfflineTransferModel }
