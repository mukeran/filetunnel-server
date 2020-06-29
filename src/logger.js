/**
 * Configure logger
 */
const { getLogger } = require('log4js')

const logger = getLogger('Server')
logger.level = 'all'

module.exports = {
  logger
}
