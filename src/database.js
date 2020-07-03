const mongoose = require('mongoose')
const config = require('./config')
const { logger } = require('./logger')

mongoose.connect(config.database, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
mongoose.connection.on('error', (err) => {
  logger.fatal(`Cannot connect to database ${config.database}. ${err}`)
})
mongoose.connection.on('connected', () => {
  logger.info(`Successfully connected to database ${config.database}.`)
})

module.exports = mongoose
