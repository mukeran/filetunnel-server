/**
 * Dispatch client requested actions
 */
const { logger } = require('../logger')

/* Registered actions */
const actions = {
  ...require('./alive'),
  ...require('./user'),
  ...require('./friend'),
  ...require('./transmit'),
  ...require('./offlineTransfer')
}

/**
 * Dispatch actions
 * @param {Object} packet Received packet
 * @param {Object} client Client socket instance
 */
function dispatch (packet, client) {
  logger.debug(`Got ${packet.action} packet`)
  if (typeof actions[packet.action] !== 'undefined') {
    actions[packet.action](packet, client)
  } else {
    logger.error(`Invalid action ${packet.action}`)
  }
}

module.exports = {
  dispatch
}
