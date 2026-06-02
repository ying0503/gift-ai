import { logout, getMe } from '../../utils/api'

Page({
  data: {
    email: '',
    loading: true,
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    const user = wx.getStorageSync('user')
    if (user) {
      this.setData({ email: user.email, loading: false })
    } else {
      getMe().then((res: any) => {
        if (res.user) {
          wx.setStorageSync('user', res.user)
          this.setData({ email: res.user.email, loading: false })
        }
      }).catch(() => {
        this.setData({ loading: false })
      })
    }
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await logout()
          } catch {}
          wx.removeStorageSync('token')
          wx.removeStorageSync('user')
          wx.redirectTo({ url: '/pages/login/login' })
        }
      },
    })
  },
})
