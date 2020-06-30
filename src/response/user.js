const UserModel = require('../model/user')
const { sendResponse } = require('../connection/payload')
const status = require('../status')

function register (packet, client) {
  const { username, password } = packet.data
  const crypto = require('crypto')
  const salt = crypto.randomBytes(16).toString('hex')
  UserModel.create({
    username,
    password: UserModel.getPasswordHash(password, salt),
    salt
  })
    .then((data) => {
      sendResponse(client, {
        status: status.OK,
        data: {
          _id: data._id,
          username: data.username
        }
      }, packet)
    })
    .catch((err) => {
      if (err.code === 11000 && typeof err.keyPattern.username !== 'undefined') {
        sendResponse(client, {
          status: status.register.DUPLICATED_USERNAME
        }, packet)
      } else {
        sendResponse(client, {
          status: status.UNKNOWN_ERROR
        }, packet)
      }
    })
}

function login (packet, client) {

}

module.exports = {
  register,
  login
}
