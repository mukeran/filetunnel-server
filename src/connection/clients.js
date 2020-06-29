/**
 * Active client mappings (from IP to socket instance)
 * In order to send notifications
 */
const sockets = new Map()

/**
 * Register new socket
 * @param {string} host Host
 * @param {number} port Port
 * @param {Socket} socket Socket instance
 */
function register (host, port, socket) {
  sockets.set(host + ':' + port, socket)
}

/**
 * Get socket instance by host and port
 * @param {string} host Host
 * @param {number} port Port
 * @returns {Socket} Socket instance
 */
function get (host, port) {
  return sockets.get(host + ':' + port)
}

/**
 * Delete socket instance in map by host and port
 * @param {string} host Host
 * @param {number} port Port
 */
function del (host, port) {
  sockets.delete(host + ':' + port)
}

module.exports = {
  register,
  get,
  del
}
