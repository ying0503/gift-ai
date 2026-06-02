const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')
const tokens = db.collection('tokens')

function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(salt.toString('base64') + ':' + key.toString('base64'))
    })
  })
}

function verifyPassword(password, stored) {
  const [saltB64, keyB64] = stored.split(':')
  const salt = Buffer.from(saltB64, 'base64')
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(key.toString('base64') === keyB64)
    })
  })
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

exports.main = async (event) => {
  const { action, email: rawEmail, password, token } = event
  const email = rawEmail ? rawEmail.toLowerCase().trim() : rawEmail

  try {
    // --- Register ---
    if (action === 'register') {
      if (!email || !password) return { code: 400, error: 'Email and password are required' }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { code: 400, error: 'Invalid email format' }
      if (password.length < 6) return { code: 400, error: 'Password must be at least 6 characters' }

      const existing = await users.where({ email }).get()
      if (existing.data.length) return { code: 409, error: 'Email already registered' }

      const passwordHash = await hashPassword(password)
      const userResult = await users.add({
        data: { email, passwordHash, createdAt: Date.now() },
      })

      const newToken = generateToken()
      await tokens.add({
        data: { token: newToken, userId: userResult._id, email, createdAt: Date.now() },
      })

      return { code: 200, data: { success: true, token: newToken, user: { id: userResult._id, email } } }
    }

    // --- Login ---
    if (action === 'login') {
      if (!email || !password) return { code: 400, error: 'Email and password are required' }

      const userRes = await users.where({ email }).get()
      if (!userRes.data.length) return { code: 401, error: 'Invalid email or password' }

      const user = userRes.data[0]
      const valid = await verifyPassword(password, user.passwordHash)
      if (!valid) return { code: 401, error: 'Invalid email or password' }

      const newToken = generateToken()
      await tokens.add({
        data: { token: newToken, userId: user._id, email, createdAt: Date.now() },
      })

      return { code: 200, data: { success: true, token: newToken, user: { id: user._id, email: user.email } } }
    }

    // --- Verify Token ---
    if (action === 'verifyToken') {
      if (!token) return { code: 401, error: 'Token required' }

      const tokenRes = await tokens.where({ token }).get()
      if (!tokenRes.data.length) return { code: 401, error: 'Invalid or expired token' }

      const session = tokenRes.data[0]
      return { code: 200, data: { user: { id: session.userId, email: session.email } } }
    }

    // --- Logout ---
    if (action === 'logout') {
      if (!token) return { code: 200, data: { success: true } }

      const tokenRes = await tokens.where({ token }).get()
      if (tokenRes.data.length) {
        await tokens.doc(tokenRes.data[0]._id).remove()
      }
      return { code: 200, data: { success: true } }
    }

    return { code: 404, error: 'Unknown action' }
  } catch (e) {
    return { code: 500, error: e.message || 'Internal error' }
  }
}
