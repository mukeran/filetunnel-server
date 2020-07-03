/**
 * Config file
 */
module.exports = {
  listen: {
    HOST: '::',
    PORT: 10088
  },
  connection: {
    MAX_SEQUENCE_NUMBER: 65536,
    RESPONSE_TIMEOUT: 30000,
    ALIVE_PERIOD: 10000
  },
  database: 'mongodb://127.0.0.1:27017/FileTunnel'
}
