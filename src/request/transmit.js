const crypto = require('crypto')
const { SessionModel } = require('../model/session')
const { logger } = require('../logger')
const clients = require('../connection/clients')
const { sendRequest } = require('../connection/payload')

/** a map to store next step actions */
const callbacks = new Map()

/** get a transmit id in callback map */
function getUniqueId () {
  let transmitId = crypto.randomBytes(16).toString('hex')
  while (callbacks.has(transmitId)) {
    transmitId = crypto.randomBytes(16).toString('hex')
  }
  return transmitId
}

/**
 * step 2 of transmit process
 * Sender is connected. Ask receiver to connect.
 * Asking receiver to connect after sender's connection to distinguish sender and receiver
 * @param {Socket} fromSocket sender's socket
 * @param {String} toUid sender user id
 * @param {String} tid old transmit id to send back to sender
 * @param {String} fromUid receiver user id
 */
function sendTransmit (fromSocket, toUid, tid, fromUid) {
  logger.debug('transmit got connection, start to sendTransmit')
  /** find receiver's socket */
  SessionModel.findOne({ userId: toUid })
    .then(session => {
      if (session === null) {
        logger.debug(`send transmit no session for target ${toUid}, close connection`)
        fromSocket.end()
        return
      }
      const client = clients.get(session.ip, session.controlPort)
      if (typeof client === 'undefined') {
        logger.debug(`send transmit no client for target ${toUid}, close connection`)
        fromSocket.end()
        return
      }
      fromSocket.transmitId = tid
      const transmitId = getUniqueId()
      // const fromIP = session.ip
      // const fromPort = session.controlPort
      callbacks.set(transmitId, async (toSocket) => {
        pipe(toSocket, fromSocket, fromUid)
      })
      /** ask for data connection */
      sendRequest({ action: 'sendTransmit', data: { _id: transmitId } }, client)
    })
    .catch(err => {
      logger.debug(`send transmit no session for target ${toUid}, close connection`)
      fromSocket.end()
      logger.error(err)
    })
}

/**
 * send transmit ready package
 * @param {Socker} client sender's control socket
 * @param {String} _id old transmit id
 */
function transmitReady (client, _id) {
  sendRequest({
    action: 'transmitReady',
    data: { _id }
  }, client)
}

/**
 * step 3, and last step of transmit process
 * Receiver is ready and connected, pipe connection and send transmitReady package
 * @param {Socket} toSocket receiver's data port socket
 * @param {Socket} fromSocket sender's data port socket
 * @param {String} fromUid sender's user id to find control socket
 */
function pipe (toSocket, fromSocket, fromUid) {
  /** find sender's control socket */
  SessionModel.findOne({ userId: fromUid })
    .then(session => {
      if (session === null) {
        logger.debug(`transmitReady no session for sender ${fromUid}, close connection`)
        fromSocket.end()
        toSocket.end()
        return
      }
      const client = clients.get(session.ip, session.controlPort)
      if (typeof client === 'undefined') {
        logger.error('Cannot find transmit sender\'s control socket !')
        return
      }
      logger.debug('transmit start to pipe')
      fromSocket.removeAllListeners(['data'])
      toSocket.removeAllListeners(['data'])
      fromSocket.pipe(toSocket)
      toSocket.pipe(fromSocket)
      transmitReady(client, fromSocket.transmitId)
    })
    .catch(err => {
      logger.debug(`transmitReady no session for sender ${fromUid}, close connection`)
      fromSocket.end()
      toSocket.end()
      logger.error(err)
    })
}

module.exports = { sendTransmit, transmitReady, getUniqueId, callbacks }
