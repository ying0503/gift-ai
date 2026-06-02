const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const tokens = db.collection('tokens')
const tasks = db.collection('tasks')

const WAN_API = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation'

function buildPrompt(config, excel) {
  const rows = excel.slice(1)
  const total = rows.length
  const productList = rows.map((row, i) => {
    const name = row[1] || row[0] || ''
    const desc = row[2] ? String(row[2]).slice(0, 100) : ''
    return `${i + 1}. ${name}${desc ? ` - ${desc}` : ''}`
  }).join('\n')
  const bannerCount = Math.min(3, total)
  const gridCount = total - bannerCount
  return `设计一张完整的礼品画册，板式为"顶通+礼品列表"，色调：${config.color}。
顶部是通栏广告位区域（占画面约30%高度），展示前${bannerCount}个产品，生成对应的产品图片。
${gridCount > 0 ? `下方是产品列表网格区域（3列），展示剩余${gridCount}个产品，每个产品生成对应的产品图片。` : ''}
每个产品展示：产品图片 + 品名。
画面要精美有质感，适合商务送礼场景。
总共${total}个产品。
礼品列表：
${productList}`
}

exports.main = async (event) => {
  const { token, config, excel, images } = event

  try {
    // Verify token
    const tokenRes = await tokens.where({ token }).get()
    if (!tokenRes.data.length) return { code: 401, error: 'Invalid token' }
    const session = tokenRes.data[0]

    if (!config) return { code: 400, error: 'Missing config' }

    const hasImages = images && images.length
    const prompt = config.prompt || buildPrompt(config, excel || [])
    const isMaiziai = config.model === 'maiziai-chatgpt-image-2' || config.model === 'gpt-image-2-official'

const maiziaiKey = process.env.MAIZIAI_API_KEY
  if (isMaiziai && !maiziaiKey) return { code: 500, error: 'MAIZIAI_API_KEY not configured' }

    if (isMaiziai) {
      const apiModel = config.model === 'maiziai-chatgpt-image-2' ? 'gpt-image-2' : config.model
      const bodyData = {
        model: apiModel,
        prompt,
        size: config.size === 'auto' ? undefined : config.size,
        image_size: config.image_size || '1K',
        n: 1,
      }
      if (hasImages) {
        bodyData.images = images
      }
      const body = JSON.stringify(bodyData)

      const res = await axios.post('https://www.maizitech.cn/v1/images/generations', body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${maiziaiKey}`,
        },
      })

      const data = res.data
      const maiziaiTaskId = data.data?.[0]?.task_id
      if (!maiziaiTaskId) return { code: 500, error: 'No task_id from MaiziAI' }

      const taskId = maiziaiTaskId
      await tasks.add({
        data: {
          _id: taskId,
          userId: session.userId, config, prompt,
          status: 'PENDING',
          createdAt: Date.now(),
          productCount: excel ? excel.length - 1 : 0,
          maiziaiTaskId,
        },
      })

      return { code: 200, data: { taskId } }
    }

    // WAN API
    const res = await axios.post(WAN_API, {
      model: config.model || 'wan2.7-image',
      input: {
        messages: [{ role: 'user', content: [{ text: prompt }] }],
      },
      parameters: { size: '1024*1024', n: 1, watermark: false },
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable',
      },
    })

    const data = res.data
    const taskId = data.output?.task_id
    if (!taskId) return { code: 500, error: 'No task_id returned' }

    await tasks.add({
      data: {
        _id: taskId,
        userId: session.userId, config, prompt,
        status: 'PENDING',
        createdAt: Date.now(),
        productCount: excel ? excel.length - 1 : 0,
      },
    })

    return { code: 200, data: { taskId } }
  } catch (e) {
    console.error(e)
    return { code: 500, error: e.response?.data?.error?.message || e.response?.data?.message || e.message || 'Internal error' }
  }
}
