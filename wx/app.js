App({
  data: {
    canIUse: wx.canIUse('button.open-type.getUserInfo'), //版本兼容
    serverHost: 'http://localhost:8090/',
    token: null,
    userInfo: null,
  },
  onLaunch: function() {
    this.autoLogin();
  },
  //自动登录
  autoLogin: function() {
    var that = this;
    //查有没有缓存 token, 缓存可能被清空
    wx.getStorage({
      key: 'token',
      // 有token, 到后台检查 token 是否过期
      success(res) {
        console.log("token: " + res.data);
        that.checkToken(res.data);
      },
      // 没有缓存token, 需要登录
      fail(e) {
        console.log("not saved token, login...");
        that.userLogin();
      }
    })
  },
  //检查 token 是否过期
  checkToken: function(token) {
    var that = this;
    wx.request({
      url: that.data.serverHost + 'user/token/check',
      method: 'POST',
      data: {
        token: token,
      },
      header: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      success(res) {
        if (res.data.code == 10000) {
          console.log("token not expired");
        } else {
          console.log("token expired, refresh...");
          // 去后台刷新 token
          that.refreshToken();
        }
      },
      fail(e) {
        console.error(e);
        console.error("【check token failed, login...】");
        // 走登录流程
        that.userLogin();
      }
    })
  },
  //刷新 token
  refreshToken: function() {
    var that = this;
    //查有没有缓存 refreshtoken, 缓存可能被清空
    wx.getStorage({
      key: 'refreshtoken',
      // 有refreshtoken, 到后台刷新 token
      success(res) {
        console.log("refreshtoken: " + res.data);
        that.refreshToken2(res.data);
      },
      // 没有缓存refreshtoken, 需要登录
      fail(e) {
        console.log("not saved refreshtoken, login...");
        that.userLogin();
      }
    })
  },
  //去后台刷新 token
  refreshToken2: function(refreshtoken) {
    var that = this;
    wx.request({
      url: that.data.serverHost + 'user/token/refresh',
      method: 'POST',
      data: {
        refreshtoken: refreshtoken,
      },
      header: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      success(res) {
        if (res.data.code == 10000 && res.data.data.token) {
          console.log(res.data.data.token);
          that.saveToken(res.data.data.token)
        } else {
          console.log("refresh token failed, login...");
          that.userLogin();
        }
      },
      fail(e) {
        console.error(e);
        console.error("【refresh token failed, login...】");
        that.userLogin();
      }
    })

  },
  // wx.login 获取 code,
  // wx.getUserInfo 获取 encryptedData 和 iv
  // 去后台换取 token
  userLogin: function() {
    var that = this;
    // wx.login 获取 code,
    wx.login({
      success(res) {
        if (res.code) {
          console.log("code:" + res.code);
          that.userLogin2(res.code);
        } else {
          console.error("【wx login failed】");
        }
      },
      fail(e) {
        console.error(e);
        console.error("【wx login failed】");
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
          that.userLogin3(code);
        } else { //没有授权 
          if (that.data.canIUse) {
            // 高版本, 需要转到授权页面 
            wx.navigateTo({
              url: '/pages/auth/auth?code=' + code,
            });
          } else {
            //低版本, 调用 getUserInfo, 系统自动弹出授权对话框
            that.userLogin3(code);
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
          that.data.userInfo = res.userInfo;
        }
        if (code && res.encryptedData && res.iv) {
          that.userLogin4(code, res.encryptedData, res.iv);
        } else {
          console.error("【wx getUserInfo failed】");
        }
      },
      fail(e) {
        console.error(e);
        console.error("【wx getUserInfo failed】");
      }
    })
  },
  //去后台获取用户 token
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
      success(res) {
        console.log(res)
        if (res.data.code == 10000) {
          if (res.data.data.token) {
            console.log(res.data.data.token);
            that.saveToken(res.data.data.token);
          } else {
            console.error("【userLogin token failed】")
          }
          if (res.data.data.refreshtoken) {
            console.log(res.data.data.refreshtoken);
            wx.setStorage({
              key: "refreshtoken",
              data: res.data.data.refreshtoken
            });
          } else {
            console.error("【userLogin refreshtoken failed】")
          }
        } else {
          console.error("【userLogin failed】")
        }

      },
      fail(e) {
        console.error(e);
        console.error("【userLogin failed】");
      }
    })
  },
  // 保存 token
  saveToken: function(token) {
    this.data.token = token;
    wx.setStorage({
      key: "token",
      data: token
    });
  },
  getUserInfo: function(call) {
    var that = this
    if (this.data.userInfo) {
      call(this.data.userInfo);
    } else {
      // 先从缓存查 userInfo, 缓存可能被清空,
      wx.getStorage({
        key: 'userInfo',
        success(res) {
          console.log(res.data);
          call(res.data);
          that.setData({
            userInfo: res.data
          });
        },
        fail(res) {
          console.log("not save userInfo, wx getUserInfo...");
          wx.getUserInfo({
            success(res) {
              console.log(userInfo);
              if (res.userInfo) {
                call(res.userInfo);
                that.setData({
                  userInfo: res.userInfo
                });
              }
            }
          })
        }
      })
    }
  },

})