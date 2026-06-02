import { getAlbums } from '../../utils/api'

const PAGE_SIZE = 20

Page({
  data: {
    albums: [] as any[],
    page: 0,
    totalPages: 0,
    loading: true,
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadAlbums()
  },

  async loadAlbums() {
    try {
      const res = await getAlbums()
      if (res.albums) {
        this.setData({
          albums: res.albums.map((a: any) => ({
            ...a,
            url: a.imageUrl,
            model: a.config?.model || '',
            date: new Date(a.createdAt).toLocaleDateString('zh-CN'),
            prompt: a.prompt || '',
          })),
          totalPages: Math.ceil(res.albums.length / PAGE_SIZE),
          loading: false,
        })
      }
    } catch {
      this.setData({ loading: false })
    }
  },

  openImage(e: any) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url] })
  },

  copyPrompt(e: any) {
    const prompt = e.currentTarget.dataset.prompt
    if (!prompt) return
    wx.setClipboardData({
      data: prompt,
      success() {
        wx.showToast({ title: '已复制', icon: 'none', duration: 1500 })
      },
    })
  },

  prevPage() {
    if (this.data.page > 0) {
      this.setData({ page: this.data.page - 1 })
    }
  },

  nextPage() {
    if ((this.data.page + 1) * PAGE_SIZE < this.data.albums.length) {
      this.setData({ page: this.data.page + 1 })
    }
  },
})
