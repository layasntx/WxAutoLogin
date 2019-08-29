App({
  data: {
    canIUse: wx.canIUse('button.open-type.getUserInfo'), //版本兼容
    serverHost: 'http://localhost:8090/', //服务器域名
    token: null,
    userInfo: null,
    userCall: null,
  },
  onLaunch: function() {
    this.autoLogin();
  },
  //自动登录
  autoLogin: function() {
    var that = this;
    //查有没有缓存 uuid, 缓存可能被清空
    wx.getStorage({
      key: 'uuid',
      //有uuid, 用 uuid 去后台换取 token, redis
      success(res) {
        console.log("uuid:" + res);
        that.getToken(res);
      },
      // wx.login 获取 code,
      // wx.getUserInfo 获取 encryptedData 和 iv
      // 去后台换取 token 和 uuid
      fail(res) {
        console.log("not saved uuid");
        that.userLogin()
      }
    })
  },
  //发送 uuid 到后台换取 token
  getToken: function(uuid) {
    var that = this;
    wx.request({
      url: that.data.serverHost + 'user/token',
      method: 'POST',
      data: {
        uuid: uuid,
      },
      header: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      success: (res) => {
        if (res.data.token) {
          saveToken(res.data.token);
        } else {
          console.error("【获取token失败】")
        }
      },
      fail: (e) => {
        console.error(e)
        console.error("【获取token失败】")
      }
    })
  },
  // wx.login 获取 code,
  // wx.getUserInfo 获取 encryptedData 和 iv
  // 去后台换取 token 和 uuid
  userLogin: function() {
    var that = this;
    // wx.login 获取 code,
    wx.login({
      success(res) {
        if (res.code) {
          console.log("code:" + res.code);
          that.userLogin2(res.code);
        } else {
          console.error("【获取code失败】");
        }
      },
      fail(e) {
        console.error(e);
        console.error("【获取code失败】");
      }
    })

  },
  // 检查授权, wx.getUserInfo
  userLogin2: function(code) {
    var that = this;
    // 检查是否授权
    wx.getSetting({
      success(res) {
        // 已经授权, 可以直接调用 getUserInfo 获取头像昵称
        if (res.authSetting['scope.userInfo']) {
          that.userLogin3(code)
        } else { //没有授权 
          if (that.data.canIUse) {
            // 高版本, 需要转到授权页面 
            wx.navigateTo({
              url: '/pages/auth/auth?code=' + code,
            })
          } else {
            //低版本, 调用 getUserInfo, 系统自动弹出授权对话框
            that.userLogin3(code)
          }
        }
      }
    })
  },
  // wx.getUserInfo
  userLogin3: function(code) {
    var that = this;
    wx.getUserInfo({
      success: function(res) {
        console.log(res);
        if (res.userInfo) {
          that.data.userInfo = res.userInfo
        }
        if (code && res.encryptedData && res.iv) {
          that.userLogin4(code, res.encryptedData, res.iv)
        } else {
          console.error("【getUserInfo失败】");
        }
      },
      fail(e) {
        console.error(e);
        console.error("【getUserInfo失败】");
      }
    })
  },
  //去后台获取用户 uuid 和 token
  userLogin4: function(code, data, iv) {
    var that = this;
    wx.request({
      url: that.data.serverHost + 'user/wxlogin',
      method: 'POST',
      data: {
        code: code,
        data: data,
        iv: iv,
      },
      header: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      success: (res) => {
        console.log(res)
        if (res.data.data) {
          saveToken(res.data.token);
        } else {
          console.error("【userLogin获取token失败】")
        }
        if (res.data.uuid) {
          wx.setStorage({
            key: "uuid",
            data: uuid
          });
        } else {
          console.error("【userLogin获取uuid失败】")
        }
      },
      fail: (e) => {
        console.error(e)
        console.error("【userLogin失败】")
      }
    })
  },
  // 保存 token
  saveToken: function(token) {
    this.setData({
      token: token
    })
    wx.setStorage({
      key: "token",
      data: token
    });
  },
  getUserInfo: function(call) {
    var that = this
    if (this.data.userInfo) {
      call(this.data.userInfo)
    } else {
      // 先从缓存查 userInfo, 缓存可能被清空,
      wx.getStorage({
        key: 'userInfo',
        success(res) {
          console.log(userInfo);
          call(res)
          that.setData({
            userInfo: res
          })
        },
        fail(res) {
          console.log("【没有userInfo】");
          wx.getUserInfo({
            success(res) {
              console.log(userInfo);
              if (res.userInfo) {
                call(res.userInfo)
                that.setData({
                  userInfo: res.userInfo
                })
              }
            }
          })
        }
      })
    }
  },

})