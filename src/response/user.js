const { UserModel } = require('../model/user')
const { SessionModel } = require('../model/session')
const { sendResponse } = require('../connection/payload')
const status = require('../status')
const { logger } = require('../logger')
const crypto = require('crypto')
const request = require('../request')
const { assert } = require('console')

/**
 * Register as a user
 * @param {*} packet Contains username, password and a publicKey
 * @param {*} client Cser`s remote ip and port
 */
function register (packet, client) {
  const { username, password, publicKey } = packet.data
  const salt = crypto.randomBytes(16).toString('hex')
  // Create a user in database contains username, salted password, publicKey etc
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
 * Login function
 * @param {*} packet Contains username and password
 * @param {*} client
 */
function login (packet, client) {
  const { username, password, transferPort } = packet.data
  UserModel.findOne({ username: username })
    .then(async user => {
      if (user === null) {
        sendResponse(client, { status: status.user.WRONG_USERNAME_OR_PASSWORD }, packet)
        return
      }
      if (UserModel.getPasswordHash(password, user.salt) === user.password) {
        await SessionModel.deleteOne({ userId: user._id })
        SessionModel.create({ // Create a session while login
          userId: user._id,
          sessionId: crypto.randomBytes(16).toString('hex'),
          ip: client.remoteAddress,
          controlPort: client.remotePort,
          transferPort
        })
          .then((data) => {
            logger.debug(`${user.username} has logged in`)
            sendResponse(client, { // Send response with sessionId back to client
              status: status.OK,
              data: {
                _id: user._id,
                username: user.username,
                sessionId: data.sessionId
              }
            }, packet)
              .then(() => { // Send all friend requests of current user to client
                request.sendFriendRequests(client)
              })
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
 * User logout operaion
 * @param {} packet At this circumstance it is empty
 * @param {} client
 */
function logout (packet, client) {
  // Use session to specify a user
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.session.NO_SUCH_SESSION }, packet)
        return
      }
      // Delete session while logout
      SessionModel.deleteOne(session)
        .then(() => {
          logger.debug(`${client.remoteAddress}:${client.remotePort} logged out`)
          // Send response to client and shut down
          sendResponse(client, { status: status.OK }, packet)
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}
/**
 * User change password
 * @param {*} packet Contains the username, oldpassword and new password
 * @param {*} client
 */
function changePassword (packet, client) {
  const { password, newPassword } = packet.data
  const salt = crypto.randomBytes(16).toString('hex')
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.session.NO_SUCH_SESSION }, packet)
        return
      }
      UserModel.findOne({ _id: session.userId })
        .then(user => {
          // Compare user.password with salted password that come from the request
          if (user.password === UserModel.getPasswordHash(password, user.salt)) {
            // Replace password in database with new password
            UserModel.updateOne(user, { $set: { password: UserModel.getPasswordHash(newPassword, salt), salt } })
              .then(() => {
                sendResponse(client, { status: status.OK }, packet) // Send back response
              })
          } else {
            sendResponse(client, { status: status.user.WRONG_USERNAME_OR_PASSWORD }, packet)
          }
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}
/**
 * User change publicKey
 * @param {*} packet Contains a new publicKey
 * @param {*} client
 */
function changePublicKey (packet, client) {
  const { publicKey } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.session.NO_SUCH_SESSION }, packet)
        return
      }
      UserModel.findOne({ _id: session.userId })
        .then(user => {
          UserModel.updateOne(user, { $set: { publicKey: publicKey } })
            .then(() => {
              sendResponse(client, { status: status.OK }, packet) // Send back response
            })
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

/**
 * Change user`s publicKey
 * @param {*} packet Contains userId and a new publicKey
 * @param {*} client
 */
function requestPublicKey (packet, client) {
  const { userId } = packet.data
  SessionModel.getByIpPort(client.remoteAddress, client.remotePort)
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.ACCESS_DENIED }, packet)
        return
      }
      UserModel.findOne({ _id: session.userId })
        .then(user => {
          assert(user !== null)
          if (!(userId in user.friends)) {
            sendResponse(client, { status: status.ACCESS_DENIED }, packet)
            return
          }
          UserModel.findOne({ _id: userId })
            .then(user => {
              if (user === null) {
                sendResponse(client, { status: status.user.NO_SUCH_USER }, packet)
                return
              }
              // Send response with the publicKey of target user
              sendResponse(client, {
                status: status.OK,
                data: { publicKey: user.publicKey }
              }, packet)
            })
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

function resumeSession (packet, client) {
  const { sessionId, transferPort } = packet.data
  SessionModel.findOne({ sessionId })
    .then(session => {
      if (session === null) {
        sendResponse(client, { status: status.session.NO_SUCH_SESSION }, packet)
        return
      }
      SessionModel.updateOne(session, { $set: { ip: client.remoteAddress, controlPort: client.remotePort, transferPort } })
        .then(() => {
          sendResponse(client, { status: status.OK }, packet)
          request.sendFriendRequests(client)
        })
    })
    .catch(err => {
      logger.error(err)
      sendResponse(client, { status: status.UNKNOWN_ERROR }, packet)
    })
}

module.exports = {
  register,
  login,
  logout,
  changePassword,
  changePublicKey,
  requestPublicKey,
  resumeSession
}
