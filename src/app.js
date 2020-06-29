/**
 * App entry
 */
const { startServer } = require('./server')
const config = require('./config')

startServer(config.listen.HOST, config.listen.PORT)
