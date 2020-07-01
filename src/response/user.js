const { UserModel, SessionModel } = require('../model/user')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const logger = require('../logger')

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
  const { username, password } = packet.data
  UserModel.findOne({ username: username }, function (err, user) {
    if (err) throw err
    console.log(user.online)
    console.log('%s %s %s', user.username, user.salt, user.password)
    console.log(UserModel.getPasswordHash(password, user.salt) + '\n' + user.password)
    // eslint-disable-next-line eqeqeq
    if (UserModel.getPasswordHash(password, user.salt) == user.password) {
      UserModel.updateOne({ user }, { $set: { online: true } }, function (err, res) {
        if (err) throw err
        console.log(user.online)
        console.log(user._id.toString())
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
              sessionId: data._id
            }
          }, packet)
        })
        .catch((err) => {
          console.log(err)
          sendResponse(client, {
            status: -1,
            detail: 'session fail'
          }, packet)
        })
    } else {
      console.log(user.username + ' failed logged in, wrong password')
      sendResponse(client, {
        status: 300,
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
  const { username, password, newpwd } = packet.data
  UserModel.findOne({ username }, function (err, user) {
    if (err) throw err
    if (user.password === UserModel.getPasswordHash(password, user.salt)) {
      UserModel.updateOne({ username }, { $set: { password: newpwd } }, function (err, result) {
        if (err) throw err
        console.log(result)
      })
    }
  })
}

module.exports = {
  register,
  login,
  logout,
  changePassword
}
