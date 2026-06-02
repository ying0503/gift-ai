let initialized = false

export function initCloud() {
  if (initialized) return
  wx.cloud.init({
    env: 'd257fd3c-f6a2-44c7-b96e-42102d6f2acO', // 替换为你的云开发环境ID
    traceUser: true,
  })
  initialized = true
}

export function callFunction(name: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        const result = res.result as any
        if (result.code && result.code >= 400) {
          reject(new Error(result.error || '请求失败'))
        } else {
          resolve(result.data !== undefined ? result.data : result)
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络错误'))
      },
    })
  })
}

export async function login(email: string, password: string) {
  return callFunction('auth', { action: 'login', email, password })
}

export async function register(email: string, password: string) {
  return callFunction('auth', { action: 'register', email, password })
}

export async function getMe() {
  const token = wx.getStorageSync('token')
  return callFunction('auth', { action: 'verifyToken', token })
}

export async function logout() {
  const token = wx.getStorageSync('token')
  return callFunction('auth', { action: 'logout', token })
}

export async function generate(config: any, excel: any, images?: string[]) {
  const token = wx.getStorageSync('token')
  return callFunction('generate', { token, config, excel, images })
}

export async function getStatus(taskId: string) {
  return callFunction('getStatus', { taskId })
}

export async function getAlbums() {
  const token = wx.getStorageSync('token')
  return callFunction('getAlbums', { token })
}
