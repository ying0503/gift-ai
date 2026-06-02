const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const tokens = db.collection('tokens')
const userAlbums = db.collection('user_albums')
const albums = db.collection('albums')

exports.main = async (event) => {
  const { token } = event

  try {
    const tokenRes = await tokens.where({ token }).get()
    if (!tokenRes.data.length) return { code: 401, error: 'Invalid token' }
    const session = tokenRes.data[0]

    const uaRes = await userAlbums.where({ userId: session.userId }).get()
    const ids = uaRes.data.length ? uaRes.data[0].list : []

    const albumList = []
    for (const id of ids) {
      try {
        const { data } = await albums.doc(id).get()
        if (data) albumList.push(data)
      } catch {}
    }

    return { code: 200, data: { albums: albumList } }
  } catch (e) {
    return { code: 500, error: e.message || 'Internal error' }
  }
}
