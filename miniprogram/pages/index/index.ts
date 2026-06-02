import { generate, getStatus, getAlbums } from '../../utils/api'

const RATIOS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4']
const RESOLUTIONS = ['1K', '2K', '4K']
const MODELS = ['maiziai-chatgpt-image-2', 'gpt-image-2-official', 'wan2.7-image', 'wan2.7-image-pro']
const PAGE_SIZE = 20

Page({
  data: {
    promptText: '',
    sizeIndex: 0,
    resIndex: 0,
    modelIndex: 0,
    ratios: RATIOS,
    resolutions: RESOLUTIONS,
    models: MODELS,
    refImages: [] as string[],
    generating: false,
    cards: [] as any[],
    albums: [] as any[],
    page: 0,
    allCards: [] as any[],
    totalPages: 0,
    canGenerate: false,
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadAlbums()
    this.updateDerived()
  },

  updateDerived() {
    const { cards, albums, page, promptText, modelIndex } = this.data
    const inProgress = [...cards].filter(c => !c.finished).reverse()
    const finished = [...cards].filter(c => c.finished).reverse()
    const start = page * PAGE_SIZE
    const pagedAlbums = albums.slice(start, start + PAGE_SIZE)
    this.setData({
      allCards: [...inProgress, ...finished, ...pagedAlbums] as any[],
      totalPages: Math.ceil(albums.length / PAGE_SIZE),
      canGenerate: !!(MODELS[modelIndex] && promptText.length > 10),
    })
  },

  onPromptInput(e: any) {
    this.setData({ promptText: e.detail.value }, () => this.updateDerived())
  },

  onSizeChange(e: any) {
    this.setData({ sizeIndex: e.detail.value }, () => this.updateDerived())
  },
  onResChange(e: any) {
    this.setData({ resIndex: e.detail.value }, () => this.updateDerived())
  },
  onModelChange(e: any) {
    this.setData({ modelIndex: e.detail.value }, () => this.updateDerived())
  },

  get size() { return RATIOS[this.data.sizeIndex] },
  get image_size() { return RESOLUTIONS[this.data.resIndex] },
  get model() { return MODELS[this.data.modelIndex] },

  importExcel() {
    wx.showToast({ title: '小程序暂不支持 Excel 导入', icon: 'none' })
  },

  uploadRef() {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFilePaths
    Promise.all(files.map(f => this.fileToBase64(f))).then(urls => {
      this.setData({ refImages: [...this.data.refImages, ...urls.filter(Boolean) as string[]] }, () => this.updateDerived())
    })
      },
    })
  },

  fileToBase64(filePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath,
        encoding: 'base64',
        success(res) {
          resolve('data:image/jpeg;base64,' + (res.data as string))
        },
        fail() { resolve(null) },
      })
    })
  },

  removeRef(e: any) {
    const url = e.currentTarget.dataset.url
    this.setData({ refImages: this.data.refImages.filter(u => u !== url) }, () => this.updateDerived())
  },

  async handleGenerate() {
    if (!this.data.canGenerate || this.data.generating) return
    this.setData({ generating: true })
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const card = {
      id, url: null, progress: 0, statusText: '准备中...',
      finished: false, model: this.model, date: new Date().toLocaleDateString('zh-CN'),
      prompt: this.data.promptText,
    }
    this.setData({ cards: [...this.data.cards, card] }, () => this.updateDerived())

    try {
      const res = await generate(
        { size: this.size, model: this.model, image_size: this.image_size, prompt: this.data.promptText },
        null,
        this.data.refImages.length ? this.data.refImages : undefined,
      )
      this.updateCard(id, { statusText: '任务已提交' })
      this.startPolling(id, res.taskId)
    } catch (e: any) {
      this.updateCard(id, { error: e.message })
      this.setData({ generating: false })
    }
  },

  updateCard(id: string, updates: any) {
    const cards = this.data.cards.map((c: any) => c.id === id ? { ...c, ...updates } : c)
    this.setData({ cards }, () => this.updateDerived())
  },

  startPolling(id: string, taskId: string) {
    const poll = async () => {
      try {
        const res = await getStatus(taskId)
        if (res.taskStatus === 'SUCCEEDED') {
          this.updateCard(id, { progress: 100, statusText: '生成完成', url: res.imageUrl, finished: true })
          this.setData({ generating: false })
          this.loadAlbums()
          return
        }
        if (res.taskStatus === 'FAILED') {
          this.updateCard(id, { progress: -1, statusText: res.statusText || '生成失败', finished: true, error: res.statusText })
          this.setData({ generating: false })
          return
        }
        this.updateCard(id, { progress: res.progress, statusText: res.statusText || '生成中...' })
        setTimeout(poll, 2000)
      } catch {
        const cur = this.data.cards.find((c: any) => c.id === id)
        this.updateCard(id, { progress: (cur?.progress || 0) + 1 })
        setTimeout(poll, 2000)
      }
    }
    setTimeout(poll, 2000)
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
        }, () => this.updateDerived())
      }
    } catch {}
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
      this.setData({ page: this.data.page - 1 }, () => this.updateDerived())
    }
  },
  nextPage() {
    if ((this.data.page + 1) * PAGE_SIZE < this.data.albums.length) {
      this.setData({ page: this.data.page + 1 }, () => this.updateDerived())
    }
  },
})
