import { initCloud } from './utils/api'

App({
  globalData: {},
  onLaunch() {
    initCloud()
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
    }
  },
})
