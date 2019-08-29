const app = getApp()

Page({
  data: {
    userInfo: {
      avatarUrl: '/image/user_avarta.png',
      nickName: '昵称'
    },
  },
  onLoad: function(param) {
    this.data.code = param.code
  },
  getUserInfo: function(res) {
    console.log(res.detail)
    app.data.userInfo = res.detail.userInfo
    this.setData({
      userInfo: res.detail.userInfo,
    })
    if (this.data.code && res.detail.encryptedData && res.detail.iv) {
      app.userLogin4(this.data.code, res.detail.encryptedData, res.detail.iv)
    } else {
      console.error("【getUserInfo失败】");
    }
  }
})