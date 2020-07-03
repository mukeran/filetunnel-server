/**
 * App entry
 */
const { startServer } = require('./server')
const config = require('./config')
const db = require('./database')
const { logger } = require('./logger')

logger.info('Waiting for database connection...')
new Promise((resolve, reject) => {
  db.connection.once('connected', resolve)
  db.connection.once('disconnected', reject)
})
  .then(() => {
    startServer(config.listen.HOST, config.listen.PORT)
  })
  .catch(() => {
    logger.error('Failed to connect to database')
  })
