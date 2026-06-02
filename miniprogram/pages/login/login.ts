import { login, register } from '../../utils/api'

Page({
  data: {
    isRegister: false,
    email: '',
    password: '',
    loading: false,
    error: '',
  },
  onEmailInput(e: any) {
    this.setData({ email: e.detail.value })
  },
  onPasswordInput(e: any) {
    this.setData({ password: e.detail.value })
  },
  toggleMode() {
    this.setData({ isRegister: !this.data.isRegister, error: '' })
  },
  async submit() {
    const { email, password, isRegister, loading } = this.data
    if (loading) return
    if (!email || !password) { this.setData({ error: '请填写邮箱和密码' }); return }
    this.setData({ loading: true, error: '' })
    try {
      const res = isRegister ? await register(email, password) : await login(email, password)
      wx.setStorageSync('token', res.token)
      wx.setStorageSync('user', res.user)
      wx.redirectTo({ url: '/pages/index/index' })
    } catch (e: any) {
      this.setData({ error: e.message })
    } finally {
      this.setData({ loading: false })
    }
  },
})
