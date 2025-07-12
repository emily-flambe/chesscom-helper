import { Router, json, error } from 'itty-router'
import { getPlayerStatus, getMonitoringStatus } from '../services/monitoringService'
import { validateChessComUsername } from '../utils/validation'
import type { Env } from '../index'

const router = Router({ base: '/api/v1/monitoring' })

router.get('/status', async (request: Request, env: Env) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const status = await getMonitoringStatus(env.DB)
    return json(status)

  } catch (err) {
    console.error('Get monitoring status error:', err)
    return error(500, 'Failed to fetch monitoring status')
  }
})

router.get('/players/:username', async (request: Request, env: Env, context: any) => {
  try {
    const userId = request.user?.id
    if (!userId) {
      return error(401, 'Unauthorized')
    }

    const username = context.params?.username
    if (!username || !validateChessComUsername(username)) {
      return error(400, 'Invalid Chess.com username')
    }

    const playerStatus = await getPlayerStatus(env.DB, username)
    if (!playerStatus) {
      return error(404, 'Player not found in monitoring system')
    }

    return json({
      username: playerStatus.chessComUsername,
      isOnline: playerStatus.isOnline,
      isPlaying: playerStatus.isPlaying,
      currentGameUrl: playerStatus.currentGameUrl,
      lastSeen: playerStatus.lastSeen,
      lastChecked: playerStatus.lastChecked
    })

  } catch (err) {
    console.error('Get player status error:', err)
    return error(500, 'Failed to fetch player status')
  }
})

router.post('/internal/check', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as { playernames?: string[] }
    
    if (body.playernames && !Array.isArray(body.playernames)) {
      return error(400, 'Playernames must be an array')
    }

    const checkResult = await import('../jobs/playerMonitoring').then(m => 
      m.checkSpecificPlayers(env, body.playernames)
    )

    return json({
      message: 'Player check initiated',
      playersChecked: checkResult.playersChecked,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Manual player check error:', err)
    return error(500, 'Failed to initiate player check')
  }
})

router.post('/internal/poll', async (request: Request, env: Env) => {
  try {
    const pollResult = await import('../jobs/playerMonitoring').then(m => 
      m.checkPlayerStatus(env, null as any)
    )

    return json({
      message: 'Polling completed',
      playersChecked: pollResult.playersChecked,
      notificationsSent: pollResult.notificationsSent,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Manual polling error:', err)
    return error(500, 'Failed to complete polling')
  }
})

export { router as monitoringRoutes }