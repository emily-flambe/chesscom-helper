import { Router, json, error } from 'itty-router'
import { getUserById, updateUser, deleteUser } from '../services/userService'
import { getPlayerSubscriptions, createPlayerSubscription, deletePlayerSubscription } from '../services/subscriptionService'
import { getUserPreferences, updateUserPreferences } from '../services/preferencesService'
import { validateChessComUsername } from '../utils/validation'
import { verifyPlayerExists } from '../services/chessComService'
import type { Env } from '../index'

const router = Router({ base: '/api/v1/users' })

router.get('/me', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const user = await getUserById(env.DB, userId)
    if (!user) {
      return error(404, 'User not found')
    }

    return json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })

  } catch (err) {
    console.error('Get user error:', err)
    return error(500, 'Failed to fetch user')
  }
})

router.put('/me', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json()
    const updatedUser = await updateUser(env.DB, userId, body)

    return json({
      id: updatedUser.id,
      email: updatedUser.email,
      updatedAt: updatedUser.updatedAt
    })

  } catch (err) {
    console.error('Update user error:', err)
    return error(500, 'Failed to update user')
  }
})

router.delete('/me', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    await deleteUser(env.DB, userId)
    return json({ message: 'Account deleted successfully' })

  } catch (err) {
    console.error('Delete user error:', err)
    return error(500, 'Failed to delete account')
  }
})

router.get('/me/subscriptions', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const subscriptions = await getPlayerSubscriptions(env.DB, userId)
    return json({ subscriptions })

  } catch (err) {
    console.error('Get subscriptions error:', err)
    return error(500, 'Failed to fetch subscriptions')
  }
})

router.post('/me/subscriptions', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json() as { chessComUsername: string }

    if (!validateChessComUsername(body.chessComUsername)) {
      return error(400, 'Invalid Chess.com username')
    }

    const playerExists = await verifyPlayerExists(body.chessComUsername, env.CHESS_COM_API_URL)
    if (!playerExists) {
      return error(404, 'Chess.com player not found')
    }

    const subscription = await createPlayerSubscription(env.DB, {
      userId,
      chessComUsername: body.chessComUsername
    })

    return json({
      id: subscription.id,
      chessComUsername: subscription.chessComUsername,
      createdAt: subscription.createdAt
    }, { status: 201 })

  } catch (err) {
    console.error('Create subscription error:', err)
    return error(500, 'Failed to create subscription')
  }
})

router.delete('/me/subscriptions', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json() as { chessComUsername: string }

    if (!validateChessComUsername(body.chessComUsername)) {
      return error(400, 'Invalid Chess.com username')
    }

    await deletePlayerSubscription(env.DB, userId, body.chessComUsername)
    return json({ message: 'Subscription removed successfully' })

  } catch (err) {
    console.error('Delete subscription error:', err)
    return error(500, 'Failed to remove subscription')
  }
})

router.get('/me/preferences', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const preferences = await getUserPreferences(env.DB, userId)
    return json({ preferences })

  } catch (err) {
    console.error('Get preferences error:', err)
    return error(500, 'Failed to fetch preferences')
  }
})

router.put('/me/preferences', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const body = await request.json()
    const preferences = await updateUserPreferences(env.DB, userId, body)

    return json({ preferences })

  } catch (err) {
    console.error('Update preferences error:', err)
    return error(500, 'Failed to update preferences')
  }
})

export { router as userRoutes }