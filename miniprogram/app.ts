App({
  globalData: {},
  onLaunch() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
    }
  },
})
