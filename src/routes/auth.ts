import { Router, json, error } from 'itty-router'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { generateToken } from '../utils/jwt'
import { validateEmail, validatePassword } from '../utils/validation'
import { createUser, getUserByEmail } from '../services/userService'
import type { Env } from '../index'

const router = Router({ base: '/api/v1/auth' })

interface RegisterRequest {
  email: string
  password: string
}

interface LoginRequest {
  email: string
  password: string
}

router.post('/register', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as RegisterRequest

    if (!validateEmail(body.email)) {
      return error(400, 'Invalid email format')
    }

    if (!validatePassword(body.password)) {
      return error(400, 'Password must be at least 8 characters with uppercase, lowercase, number, and special character')
    }

    const existingUser = await getUserByEmail(env.DB, body.email)
    if (existingUser) {
      return error(400, 'User already exists')
    }

    const passwordHash = await hashPassword(body.password)
    const user = await createUser(env.DB, {
      email: body.email,
      passwordHash
    })

    const token = await generateToken(user.id, env.JWT_SECRET)

    return json({
      userId: user.id,
      email: user.email,
      token,
      createdAt: user.createdAt
    }, { status: 201 })

  } catch (err) {
    console.error('Registration error:', err)
    return error(500, 'Registration failed')
  }
})

router.post('/login', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as LoginRequest

    if (!validateEmail(body.email) || !body.password) {
      return error(400, 'Invalid email or password')
    }

    const user = await getUserByEmail(env.DB, body.email)
    if (!user) {
      return error(401, 'Invalid credentials')
    }

    const isValidPassword = await verifyPassword(body.password, user.passwordHash)
    if (!isValidPassword) {
      return error(401, 'Invalid credentials')
    }

    const token = await generateToken(user.id, env.JWT_SECRET)

    return json({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    })

  } catch (err) {
    console.error('Login error:', err)
    return error(500, 'Login failed')
  }
})

router.post('/logout', async (request: Request, env: Env) => {
  return json({ message: 'Logged out successfully' })
})

router.post('/forgot-password', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as { email: string }

    if (!validateEmail(body.email)) {
      return error(400, 'Invalid email format')
    }

    const user = await getUserByEmail(env.DB, body.email)
    if (!user) {
      return json({ message: 'If an account exists, a reset email will be sent' })
    }

    // TODO: Implement password reset email logic
    console.log('Password reset requested for:', body.email)

    return json({ message: 'If an account exists, a reset email will be sent' })

  } catch (err) {
    console.error('Password reset error:', err)
    return error(500, 'Password reset failed')
  }
})

export { router as authRoutes }