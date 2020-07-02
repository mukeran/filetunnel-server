const { UserModel } = require('../model/user')
const { SessionModel } = require('../model/session')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const { logger } = require('../logger')
const crypto = require('crypto')
const request = require('../request')

/**
 *register as a user
 * @param {*} packet contains username, password and a publicKey
 * @param {*} client user`s remote ip and port
 */
function register (packet, client) {
  const { username, password, publicKey } = packet.data
  const salt = crypto.randomBytes(16).toString('hex')
  // create a user in database contains username, salted password, publicKey etc
  UserModel.create({
    username,
    password: UserModel.getPasswordHash(password, salt),
    salt,
    publicKey: publicKey
  })
    .then(data => {
      sendResponse(client, {
        status: status.OK,
        data: {
          _id: data._id,
          username: data.username
        }
      }, packet)
    })
    .catch(err => {
      if (err.code === 11000 && typeof err.keyPattern.username !== 'undefined') {
        sendResponse(client, { status: status.user.DUPLICATED_USERNAME }, packet)
      } else {
        logger.error(err)
        sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
      }
    })
}

/**
 *login function
 * @param {*} packet contains username and password
 * @param {*} client
 */
function login (packet, client) {
  const { username, password } = packet.data
  UserModel.findOne({ username: username })
    .then(async user => {
      if (UserModel.getPasswordHash(password, user.salt) === user.password) {
        await SessionModel.deleteOne({ userId: user._id })
        SessionModel.create({ // create a session while login
          userId: user._id,
          sessionId: crypto.randomBytes(16).toString('hex'),
          ip: client.remoteAddress,
          controlPort: client.remotePort,
          transferPort: client.remotePort
        })
          .then((data) => {
            logger.debug(`${user.username} has logged in`)
            sendResponse(client, { // send response with sessionId back to client
              status: status.OK,
              data: {
                _id: user._id,
                username: user.username,
                sessionId: data.sessionId
              }
            }, packet)
              .then(() => { // send all friend requests of current user to client
                request.sendFriendRequests(client)
              })
          })
          .catch((err) => {
            console.log(err)
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          })
      } else {
        logger.debug(`${user.username} failed logged in, wrong password`)
        sendResponse(client, { status: status.user.WRONG_USERNAME_OR_PASSWORD }, packet)
      }
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}
/**
 * logout of system
 * @param {} packet at this circumstance it is empty
 * @param {} client
 */
function logout (packet, client) {
  // use session to specify a user
  SessionModel.findOne({ ip: client.remoteAddress, controlPort: client.remotePort })
    .then(session => {
      // delete session while logout
      SessionModel.deleteOne(session)
        .then(() => {
          logger.debug(`${client.remoteAddress}:${client.remotePort} logged out`)
          // send response to client and shut down
          sendResponse(client, { status: status.OK }, packet)
        })
        .catch(err => {
          logger.error(err)
          sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}
/**
 * user change password
 * @param {*} packet contains the username, oldpassword and new password
 * @param {*} client
 */
function changePassword (packet, client) {
  const { username, password, newPassword } = packet.data
  const salt = crypto.randomBytes(16).toString('hex')
  UserModel.findOne({ _id: username })
    .then(user => {
      // compare user.password with salted password that come from the request
      if (user.password === UserModel.getPasswordHash(password, user.salt)) {
        // replace password in database with new password
        UserModel.updateOne(user, { $set: { password: UserModel.getPasswordHash(newPassword, salt), salt } })
          .then(() => {
            sendResponse(client, { status: status.OK }, packet) // send back response
          })
          .catch(err => {
            logger.error(err)
            sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
          })
      } else {
        sendResponse(client, { status: status.user.WRONG_USERNAME_OR_PASSWORD }, packet)
      }
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}
/**
 * change user`s publicKey
 * @param {*} packet contains userId and a new publicKey
 * @param {*} client
 */
function requestPublicKey (packet, client) {
  const { userId } = packet.data
  SessionModel.findOne({ _id: userId })
    .then(user => {
      // send response with the publicKey of target user
      sendResponse(client, {
        status: status.OK,
        data: { publicKey: user.publicKey }
      }, packet)
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

function resumeSession (packet, client) {
  const { sessionId } = packet.data
  SessionModel.findOne({ sessionId })
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.session.NO_SUCH_SESSION }, packet)
        return
      }
      SessionModel.updateOne(session, { $set: { ip: client.remoteAddress, controlPort: client.remotePort } })
        .then(() => {
          sendResponse(client, { status: status.OK }, packet)
        })
        .catch(err => {
          logger.error(err)
          sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
        })
    })
}

module.exports = {
  register,
  login,
  logout,
  changePassword,
  requestPublicKey,
  resumeSession
}
