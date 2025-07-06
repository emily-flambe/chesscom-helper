import { AutoRouter } from 'itty-router'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { notificationRoutes } from './routes/notifications'
import { monitoringRoutes } from './routes/monitoring'
import { authenticate } from './middleware/auth'
import { errorHandler } from './middleware/errorHandler'
import { getHTML } from './views/index'

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  ENVIRONMENT?: string
  CHESS_COM_API_URL?: string
}

const router = AutoRouter()

// Health check
router.get('/health', () => ({
  status: 'ok',
  message: 'Chesscom Helper Phase 2 - Backend Integration',
  version: '2.0.0'
}))

// Serve static assets with redirect
router.get('/majestic-knight-small.png', () => 
  Response.redirect(
    'https://raw.githubusercontent.com/emily-flambe/chesscom-helper/feature/ui-overhaul-green-theme/public/majestic-knight-small.png',
    302
  )
)

router.get('/favicon.png', () => 
  Response.redirect(
    'https://raw.githubusercontent.com/emily-flambe/chesscom-helper/feature/ui-overhaul-green-theme/public/favicon.png',
    302
  )
)

// Auth routes (no authentication required)
router.all('/api/v1/auth/*', authRoutes.fetch)

// Apply authentication middleware to all other API routes
router.all('/api/v1/*', authenticate, (request, env) => {
  const url = new URL(request.url)
  
  // Route to appropriate handler based on path
  if (url.pathname.startsWith('/api/v1/users')) {
    return userRoutes.fetch(request, env)
  } else if (url.pathname.startsWith('/api/v1/notifications')) {
    return notificationRoutes.fetch(request, env)
  } else if (url.pathname.startsWith('/api/v1/monitoring')) {
    return monitoringRoutes.fetch(request, env)
  }
  
  return new Response('Not Found', { status: 404 })
})

// Main page
router.get('/', () => new Response(getHTML(), {
  headers: { 'Content-Type': 'text/html' }
}))

// Catch-all error handler
router.all('*', () => new Response('Not Found', { status: 404 }))

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.fetch(request, env, ctx).catch(errorHandler)
}