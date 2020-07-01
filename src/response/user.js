const { UserModel, SessionModel } = require('../model/user')
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
  function login (packet, client) {
  const { username, password } = packet.data
  UserModel.findOne({ username: username }, function (err, user) {
    if (err) throw err
    console.log(user)
    console.log('%s %s %s', user.username, user.salt, user.password)
    console.log(UserModel.getPasswordHash(password, user.salt) + '\n' + user.password)
    // eslint-disable-next-line eqeqeq
    if (UserModel.getPasswordHash(password, user.salt) == user.password) {
      UserModel.updateOne({ user }, { $set: { online: true } }, function (err, res) {
        if (err) throw err
        console.log(user.online)
        console.log(user._id.toString())
      }) // 设置一个online 字段表示已经登录    sessionID协商
      SessionModel.create({
        userID: user._id.toString(),
        ip: client.ip,
        controlPort: client.port,
        transferPort: client.port
      }, function (err, result) {
        if (err) throw err
        console.log(result)
      })
      console.log(user.username + ' has logged in')
      sendResponse(client, {
        status: 200,
        Logged_in: 'success'
      }, packet)
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
  const { username, sessionID } = packet.data
  SessionModel.findOne({ sessionID }, function (_err, session) {
    if (_err) throw _err
    console.log(session)
    SessionModel.deleteOne({ session })
    sendResponse(client, {
      status: status.OK,
      data: username + ' has logged out'
    })
  })
}
function changePassword(packet, client) {
  const { username, password, newpwd } = packet.data
  UserModel.findOne({ username }, function (err, user) {
    if (err) throw err
    console.log(user.username)
    if (user.password == UserModel.getPasswordHash(password, salt) {
      UserModel.updateOne({username}, { $set { password: newpwd }} )
    }
  })

}

module.exports = {
  register,
  login,
  logout
}
