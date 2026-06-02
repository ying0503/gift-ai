const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const tasks = db.collection('tasks')
const albums = db.collection('albums')
const userAlbums = db.collection('user_albums')

const MAIZIAI_KEY = process.env.MAIZIAI_API_KEY

exports.main = async (event) => {
  const { taskId } = event
  if (!taskId) return { code: 400, error: 'Missing taskId' }

  try {
    const taskRes = await tasks.doc(taskId).get()
    if (!taskRes.data) return { code: 404, error: 'Task not found' }
    const task = taskRes.data

    if (task.status === 'SUCCEEDED') {
      return { code: 200, data: { taskStatus: 'SUCCEEDED', progress: 100, statusText: '生成完成', imageUrl: task.imageUrl } }
    }
    if (task.status === 'FAILED') {
      return { code: 200, data: { taskStatus: 'FAILED', progress: -1, statusText: task.statusText || '生成失败', imageUrl: null } }
    }

    // Poll MaiziAI
    if (task.status === 'PENDING' && task.maiziaiTaskId) {
      const maiziaiKey = MAIZIAI_KEY
      if (!maiziaiKey) return { code: 200, data: { taskStatus: 'PENDING', progress: 0, statusText: '等待生成...', imageUrl: null } }

      const mRes = await axios.get(`https://www.maizitech.cn/v1/tasks/${task.maiziaiTaskId}`, {
        headers: { Authorization: `Bearer ${maiziaiKey}` },
      })
      const mData = mRes.data

      if (mData.status === 'completed') {
        const relativeUrl = mData.result_urls?.[0]
        const imageUrl = relativeUrl ? `https://www.maizitech.cn${relativeUrl}` : null
        if (imageUrl) {
          await tasks.doc(taskId).update({
            data: { status: 'SUCCEEDED', imageUrl },
          })
          const albumId = taskId.slice(0, 8)
          await albums.add({
            data: { _id: albumId, userId: task.userId, taskId, imageUrl, config: task.config, prompt: task.prompt, productCount: task.productCount, createdAt: task.createdAt },
          })
          const uaRes = await userAlbums.where({ userId: task.userId }).get()
          const list = uaRes.data.length ? uaRes.data[0].list : []
          list.unshift(albumId)
          if (uaRes.data.length) {
            await userAlbums.doc(uaRes.data[0]._id).update({ data: { list: list.slice(0, 50) } })
          } else {
            await userAlbums.add({ data: { userId: task.userId, list: [albumId] } })
          }
          return { code: 200, data: { taskStatus: 'SUCCEEDED', progress: 100, statusText: '生成完成', imageUrl } }
        }
      } else if (mData.status === 'failed') {
        const statusText = mData.error_msg || '生成失败'
        await tasks.doc(taskId).update({ data: { status: 'FAILED', statusText } })
        return { code: 200, data: { taskStatus: 'FAILED', progress: -1, statusText, imageUrl: null } }
      }
      return { code: 200, data: { taskStatus: 'PENDING', progress: mData.progress || 0, statusText: '生成中...', imageUrl: null } }
    }

    // Poll WAN API
    try {
      const wanRes = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` },
      })
      const data = wanRes.data
      const taskStatus = data.output?.task_status

      if (taskStatus === 'PENDING') {
        return { code: 200, data: { taskStatus, progress: 10, statusText: '任务已提交，排队中...', imageUrl: null } }
      } else if (taskStatus === 'RUNNING') {
        return { code: 200, data: { taskStatus, progress: 40, statusText: '正在生成图片...', imageUrl: null } }
      } else if (taskStatus === 'SUCCEEDED') {
        const choice = data.output?.choices?.[0]
        const imageUrl = choice?.message?.content?.[0]?.image || choice?.message?.content?.[0]?.image_url || null
        if (imageUrl) {
          await tasks.doc(taskId).update({ data: { status: 'SUCCEEDED', imageUrl } })
          const albumId = taskId.slice(0, 8)
          await albums.add({
            data: { _id: albumId, userId: task.userId, taskId, imageUrl, config: task.config, prompt: task.prompt, productCount: task.productCount, createdAt: task.createdAt },
          })
          const uaRes = await userAlbums.where({ userId: task.userId }).get()
          const list = uaRes.data.length ? uaRes.data[0].list : []
          list.unshift(albumId)
          if (uaRes.data.length) {
            await userAlbums.doc(uaRes.data[0]._id).update({ data: { list: list.slice(0, 50) } })
          } else {
            await userAlbums.add({ data: { userId: task.userId, list: [albumId] } })
          }
          return { code: 200, data: { taskStatus, progress: 100, statusText: '生成完成', imageUrl } }
        }
      } else if (taskStatus === 'FAILED') {
        return { code: 200, data: { taskStatus, progress: -1, statusText: data.output?.message || '生成失败', imageUrl: null } }
      }
    } catch (e) {
      console.error('WAN poll error:', e)
    }

    return { code: 200, data: { taskStatus: 'PENDING', progress: 0, statusText: '处理中...', imageUrl: null } }
  } catch (e) {
    console.error(e)
    return { code: 500, error: e.message || 'Internal error' }
  }
}
