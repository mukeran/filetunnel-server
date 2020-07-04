const friend = require('./friend')
const offlineTransfer = require('./offlineTransfer')

module.exports = {
  ...friend,
  ...offlineTransfer
}
