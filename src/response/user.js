const { UserModel, SessionModel } = require('../model/user')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const logger = require('../logger')

function register (packet, client) {
  const { username, password, publicKey } = packet.data
  const crypto = require('crypto')
  const salt = crypto.randomBytes(16).toString('hex')
  UserModel.create({
    username,
    password: UserModel.getPasswordHash(password, salt),
    salt,
    publicKey: publicKey,
    online: false
  })
    .then((data) => {
      console.log('publickey+++++++++++++++')
      sendResponse(client, {
        status: status.OK,
        data: {
          _id: data._id,
          username: data.username
        }
      }, packet)
    })
    .catch((err) => {
      console.log(packet)
      console.log('9----------------9')
      console.log(err)
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
  const { username, password } = packet.data
  UserModel.findOne({ username: username }, function (err, user) {
    if (err) throw err
    console.log(user.online)
    console.log('%s %s %s', user.username, user.salt, user.password)
    console.log(UserModel.getPasswordHash(password, user.salt) + '\n' + user.password)
    // eslint-disable-next-line eqeqeq
    if (UserModel.getPasswordHash(password, user.salt) == user.password) {
      UserModel.updateOne({ user }, { $set: { online: true } })
        .then((res) => {
          console.log(res)
        })
        .catch(err => {
          logger.error(err)
        })

      SessionModel.create({
        userID: user._id,
        sessionID: '_id',
        ip: client.remoteAddress,
        controlPort: client.remotePort,
        transferPort: client.remotePort
      })
        .then((data) => {
          console.log(user.username + ' has logged in')
          sendResponse(client, {
            status: status.OK,
            data: {
              _id: user._id,
              username: user.username,
              sessionId: data._id,
              publicKey: user.publicKey
            }
          }, packet)
        })
        .catch((err) => {
          console.log(err)
          sendResponse(client, {
            status: status.FAILED,
            detail: 'session fail'
          }, packet)
        })
    } else {
      console.log(user.username + ' failed logged in, wrong password')
      sendResponse(client, {
        status: status.FAILED,
        Logged_in: 'failed'
      }, packet)
    }
  })
}

function logout (packet, client) {
  SessionModel.findOne({ ip: client.remoteAddress, controlPort: client.remotePort })
    .then(session => {
      SessionModel.deleteOne(session)
        .then(() => {
          sendResponse(client, {
            status: status.OK
          }, packet)
        })
        .catch(err => {
          logger.error(err)
          sendResponse(client, {
            status: status.UNKNOWN_ERROR
          }, packet)
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, {
        status: status.UNKNOWN_ERROR
      }, packet)
    })
}

function changePassword (packet, client) {
  const { username, password, newPassword } = packet.data
  UserModel.findOne({ _id: username })
    .then(user => {
      if (user.password === UserModel.getPasswordHash(password, user.salt)) {
        UserModel.updateOne(user, { $set: { password: UserModel.getPasswordHash(newPassword, user.salt) } })
          .then(result => {
            console.log(result)
            sendResponse(client, {
              status: status.OK,
              detail: 'password changed!'
            }, packet)
          })
          .catch(err => {
            console.log(err)
            sendResponse(client, {
              status: status.FAILED,
              data: 'MongoDB update err'
            }, packet)
          })
      } else {
        sendResponse(client, {
          status: status.FAILED,
          data: 'Wrong password!'
        }, packet)
      }
    })
    .catch(err => {
      console.log(err)
      sendResponse(client, {
        status: status.UNKNOWN_ERROR,
        date: 'can`t find user'
      }, packet)
    })
}
module.exports = {
  register,
  login,
  logout,
  changePassword
}
