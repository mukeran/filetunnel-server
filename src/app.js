/**
 * App entry
 */
const { startServer, startDataServer } = require('./server')
const config = require('./config')
const db = require('./database')
const { logger } = require('./logger')
const fs = require('fs')
const { startTransferServer } = require('./transferServer')

if (!fs.existsSync(config.offlineDir)) {
  fs.mkdirSync(config.offlineDir)
}

logger.info('Waiting for database connection...')
new Promise((resolve, reject) => {
  db.connection.once('connected', resolve)
  db.connection.once('disconnected', reject)
})
  .then(() => {
    startServer(config.listen.HOST, config.listen.PORT)
    startTransferServer(config.listen.HOST, config.listen.TRANSFER_PORT)
  })
  .catch(() => {
    logger.error('Failed to connect to database')
  })
