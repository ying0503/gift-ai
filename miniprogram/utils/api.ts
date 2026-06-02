const API_BASE = 'https://gift-album-backend.yingganfei.workers.dev'

function getToken(): string {
  return wx.getStorageSync('token') || ''
}

function request<T>(url: string, options: WechatMiniprogram.RequestOption = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) header['Authorization'] = `Bearer ${token}`
    wx.request({
      ...options,
      url: `${API_BASE}${url}`,
      header: { ...header, ...options.header },
      success(res) {
        if (res.statusCode >= 400) {
          reject(new Error((res.data as any)?.error || '请求失败'))
        } else {
          resolve(res.data as T)
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络错误'))
      },
    })
  })
}

export function login(email: string, password: string) {
  return request<{ success: boolean; token: string; user: { id: string; email: string } }>('/api/login', {
    method: 'POST',
    data: { email, password },
  })
}

export function register(email: string, password: string) {
  return request<{ success: boolean; token: string; user: { id: string; email: string } }>('/api/register', {
    method: 'POST',
    data: { email, password },
  })
}

export function getMe() {
  return request<{ user: { id: string; email: string } }>('/api/me')
}

export function logout() {
  return request<{ success: boolean }>('/api/logout', { method: 'POST' })
}

export function generate(config: any, excel: any, images?: string[]) {
  return request<{ taskId: string }>('/api/generate', {
    method: 'POST',
    data: { config, excel, images },
  })
}

export function getStatus(taskId: string) {
  return request<{ taskStatus: string; progress: number; statusText: string; imageUrl: string | null }>(
    `/api/generate/status?taskId=${taskId}`
  )
}

export function getAlbums() {
  return request<{ albums: any[] }>('/api/albums')
}
