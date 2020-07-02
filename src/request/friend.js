
const SessionModel = require('../model/session')
const FriendRequestsModel = require('../model/friendRequests')
const UserModel = require('../model/user')
const { sendRequest } = require('../connection/payload')
const status = require('../status')
// const { get } = require('../connection/clients')
function sendFriendRequests (packet, client) {
  // const client = get(host, port)
  var uID, uName
  var requestsData = []
  SessionModel.getUserID('1', '1', async function (_err, user) {
    console.log('I am: ' + user)
    if (user != null) {
      uID = user.userID
    }
    await UserModel.findOne({ userID: uID })
      .then((data) => {
        uName = data.username
      })
    console.log('uID:' + uID)
    console.log('uName: ' + uName)
    await FriendRequestsModel.find({ toUserId: uID }) // 接收方为自己
      .then(async (data) => {
        console.log('requests2-done')
        for (const index in data) {
          const item = data[index]
          const obj = {}
          console.log('got one request:' + data[index])
          await UserModel.findOne({ userID: item.fromUserId })
            .then((userData) => {
              console.log('userdata:' + userData)
              if (userData.username != null) {
                console.log(userData.username)
                obj.fromUsername = userData.username
                obj.fromUserId = userData.userID
                obj._id = data[index]._id
                requestsData.push(obj)
                console.log('one obj: ' + obj)
              }
              // friendsData.push(obj)
            })
          console.log('After: ' + index + ' ' + JSON.stringify(requestsData))
        }
      })
      .catch((err) => {
        console.log('requestFriendList-err')
        sendRequest({
          action: 'sendFriendRequests',
          status: status.UNKNOWN_ERROR,
          errcode: err.code
        }, client)
      })
    sendRequest({
      action: 'sendFriendRequests',
      status: status.OK,
      data: {
        requestsData: requestsData
      }
    }, client)
  })
}

module.exports = {
  sendFriendRequests
}
