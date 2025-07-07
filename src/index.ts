export interface Env {
  DB: D1Database
  JWT_SECRET: string
  ENVIRONMENT?: string
}

import { validateEmail, validatePassword } from './utils/validation'

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

// Simple JWT creation
async function createJWT(userId: string, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) } // 7 days
  
  const headerB64 = btoa(JSON.stringify(header))
  const payloadB64 = btoa(JSON.stringify(payload))
  const message = `${headerB64}.${payloadB64}`
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  
  return `${message}.${signatureB64}`
}

// Simple JWT verification
async function verifyJWT(token: string, secret: string): Promise<{ userId: string } | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.')
    const message = `${headerB64}.${payloadB64}`
    
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    const signatureBuffer = Uint8Array.from(atob(signatureB64) || '', c => c.charCodeAt(0))
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, encoder.encode(message))
    
    if (!isValid) {
      return null
    }
    
    const payload = JSON.parse(atob(payloadB64) || '{}')
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    return { userId: payload.sub }
  } catch {
    return null
  }
}

// Helper to authenticate requests
async function authenticateRequest(request: Request, env: Env): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  
  const token = authHeader.substring(7)
  const payload = await verifyJWT(token, env.JWT_SECRET)
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  
  return payload
}

// Generate secure ID
function generateId(): string {
  return crypto.randomUUID()
}

// Chess.com validation
async function validateChessComUser(username: string): Promise<{ exists: boolean, data?: any }> {
  try {
    const normalizedUsername = username.toLowerCase()
    const response = await fetch(`https://api.chess.com/pub/player/${normalizedUsername}`, {
      headers: { 'User-Agent': 'Chesscom-Helper/1.0' }
    })
    
    if (response.status === 200) {
      const data = await response.json()
      return { exists: true, data }
    } else if (response.status === 404) {
      return { exists: false }
    }
    
    return { exists: true }
  } catch (error) {
    console.error('Chess.com API error:', error)
    return { exists: true }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Chesscom Helper running with D1 and secure user isolation'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // User Registration
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        const body = await request.json() as { email: string, password: string }
        
        if (!body.email || !body.password) {
          return new Response(JSON.stringify({ error: 'Email and password required' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }

        // Validate email format
        if (!validateEmail(body.email)) {
          return new Response(JSON.stringify({ error: 'Invalid email format' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }

        // Validate password length
        if (!validatePassword(body.password)) {
          return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Check if user exists
        const existingUser = await env.DB.prepare(`
          SELECT id FROM users WHERE email = ?
        `).bind(body.email).first()
        
        if (existingUser) {
          return new Response(JSON.stringify({ error: 'User already exists' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Create user
        const userId = generateId()
        const passwordHash = await hashPassword(body.password)
        const now = new Date().toISOString()
        
        await env.DB.prepare(`
          INSERT INTO users (id, email, password_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(userId, body.email, passwordHash, now, now).run()
        
        // Create JWT
        const token = await createJWT(userId, env.JWT_SECRET)
        
        return new Response(JSON.stringify({ 
          success: true, 
          token, 
          email: body.email,
          userId
        }), { headers: { 'Content-Type': 'application/json' } })
        
      } catch (error) {
        console.error('Registration error:', error)
        return new Response(JSON.stringify({ error: 'Registration failed' }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // User Login
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json() as { email: string, password: string }
        
        if (!body.email || !body.password) {
          return new Response(JSON.stringify({ error: 'Email and password required' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Get user
        const user = await env.DB.prepare(`
          SELECT id, email, password_hash FROM users WHERE email = ?
        `).bind(body.email).first()
        
        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), 
            { status: 401, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Verify password
        const isValid = await verifyPassword(body.password, user.password_hash as string)
        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), 
            { status: 401, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Create JWT
        const token = await createJWT(user.id as string, env.JWT_SECRET)
        
        return new Response(JSON.stringify({ 
          success: true, 
          token, 
          user: { id: user.id, email: user.email }
        }), { headers: { 'Content-Type': 'application/json' } })
        
      } catch (error) {
        console.error('Login error:', error)
        return new Response(JSON.stringify({ error: 'Login failed' }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Get players API - NOW WITH AUTHENTICATION AND USER ISOLATION
    if (url.pathname === '/api/players' && request.method === 'GET') {
      const authResult = await authenticateRequest(request, env)
      if (authResult instanceof Response) {
        return authResult
      }
      
      try {
        // Get user-specific subscriptions from database
        const subscriptions = await env.DB.prepare(`
          SELECT chess_com_username FROM player_subscriptions WHERE user_id = ?
        `).bind(authResult.userId).all()
        
        const players = subscriptions.results.map((row: any) => row.chess_com_username)
        
        return new Response(JSON.stringify({ 
          players,
          count: players.length
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('Get players error:', error)
        return new Response(JSON.stringify({ error: 'Failed to fetch players' }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Monitor player API - NOW WITH AUTHENTICATION AND USER ISOLATION
    if (url.pathname === '/api/monitor' && request.method === 'POST') {
      const authResult = await authenticateRequest(request, env)
      if (authResult instanceof Response) {
        return authResult
      }
      
      try {
        const body = await request.json() as { username: string }
        
        if (!body.username || body.username.length < 3) {
          return new Response(JSON.stringify({ error: 'Invalid username' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Check if user already monitors this player
        const existing = await env.DB.prepare(`
          SELECT id FROM player_subscriptions WHERE user_id = ? AND chess_com_username = ?
        `).bind(authResult.userId, body.username).first()
        
        if (existing) {
          return new Response(JSON.stringify({ error: `Already monitoring ${body.username}` }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Validate user exists on Chess.com
        const validation = await validateChessComUser(body.username)
        if (!validation.exists) {
          return new Response(JSON.stringify({ 
            error: `User "${body.username}" not found on Chess.com. Try the exact username (e.g., "MagnusCarlsen" instead of "Magnus")` 
          }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Add to user's subscriptions in database
        const subscriptionId = generateId()
        const now = new Date().toISOString()
        
        await env.DB.prepare(`
          INSERT INTO player_subscriptions (id, user_id, chess_com_username, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(subscriptionId, authResult.userId, body.username, now).run()
        
        return new Response(JSON.stringify({ 
          success: true,
          message: `Started monitoring ${body.username}`,
          username: body.username
        }), { headers: { 'Content-Type': 'application/json' } })
        
      } catch (error) {
        console.error('Monitor player error:', error)
        return new Response(JSON.stringify({ error: 'Failed to add player monitoring' }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }
    
    // Serve static assets
    if (url.pathname === '/majestic-knight-small.png' || url.pathname === '/favicon.png') {
      // In production, these should be served by CDN or static hosting
      // For now, redirect to the current branch where files exist
      const imageName = url.pathname.substring(1) // remove leading slash
      return new Response('', {
        status: 302,
        headers: {
          'Location': `https://raw.githubusercontent.com/emily-flambe/chesscom-helper/feature/ui-overhaul-green-theme/public/${imageName}`,
          'Cache-Control': 'public, max-age=86400'
        }
      })
    }
    
    // Main page
    if (url.pathname === '/') {
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    return new Response('Not Found', { status: 404 })
  }
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <title>Chesscom Helper</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/majestic-knight-small.png">
    <style>
      /* CSS Variables for Green Color Palette */
      :root {
        /* Primary Greens (replacing blues) */
        --primary-green: #66bb6a;
        --primary-green-light: #81c784;
        --primary-green-dark: #4caf50;
        
        /* Background Greens (replacing blue-grays) */
        --bg-dark-forest: #0f1f0f;
        --bg-dark-green: #1b2e1b;
        --bg-green-gray: #1a2e1a;
        
        /* Semantic Colors */
        --success-green: #4caf50;
        --warning-amber: #ff9800;
        --error-red: #f44336;
        
        /* Text & Neutrals */
        --text-primary: #e8eaed;
        --text-secondary: #9aa0a6;
        --border-gray: #333;
        --border-green: #2e5d32;
        
        /* Spacing */
        --spacing-xs: 0.25rem;
        --spacing-sm: 0.5rem;
        --spacing-md: 1rem;
        --spacing-lg: 1.5rem;
        --spacing-xl: 2rem;
        
        /* Border Radius */
        --radius-sm: 4px;
        --radius-md: 8px;
        --radius-lg: 12px;
        --radius-xl: 20px;
      }
      
      /* Reset & Base Styles */
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        background: var(--bg-dark-forest);
        color: var(--text-primary);
        line-height: 1.6;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      /* Header Navigation */
      .header {
        background: var(--bg-dark-green);
        border-bottom: 1px solid var(--border-green);
        padding: var(--spacing-md) var(--spacing-xl);
        position: sticky;
        top: 0;
        z-index: 100;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .header-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--primary-green);
        text-decoration: none;
      }
      
      .logo-icon {
        width: 32px;
        height: 32px;
        object-fit: contain;
      }
      
      .logo-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.2;
      }
      
      .logo-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--primary-green);
      }
      
      .logo-tagline {
        font-size: 0.75rem;
        font-style: italic;
        color: var(--text-secondary);
        margin-top: -2px;
      }
      
      .nav-user {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }
      
      .nav-user.auth-nav {
        gap: var(--spacing-sm);
      }
      
      .nav-user .welcome {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      
      .nav-user .username {
        color: var(--primary-green);
        font-weight: 600;
      }
      
      .nav-button {
        background: var(--primary-green);
        color: white;
        border: none;
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-md);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }
      
      .nav-button:hover {
        background: var(--primary-green-light);
        transform: translateY(-1px);
      }
      
      .nav-button.secondary {
        background: var(--bg-green-gray);
        color: var(--text-primary);
        border: 1px solid var(--border-green);
      }
      
      .nav-button.secondary:hover {
        background: var(--border-green);
      }
      
      /* Main Layout */
      .main-layout {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: var(--spacing-xl);
      }
      
      .container {
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xl);
      }
      
      /* Auth Section */
      .auth-container {
        background: var(--bg-dark-green);
        padding: var(--spacing-xl);
        border-radius: var(--radius-xl);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        margin: 0 auto;
      }
      
      .auth-header {
        text-align: center;
        margin-bottom: var(--spacing-xl);
      }
      
      .auth-title {
        color: var(--primary-green);
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 var(--spacing-sm) 0;
      }
      
      .auth-subtitle {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin: 0;
      }
      
      .auth-tabs {
        display: flex;
        margin-bottom: var(--spacing-lg);
        background: var(--bg-green-gray);
        border-radius: var(--radius-md);
        padding: var(--spacing-xs);
      }
      
      .auth-tab {
        flex: 1;
        padding: var(--spacing-sm) var(--spacing-md);
        text-align: center;
        background: transparent;
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--text-secondary);
        font-weight: 500;
      }
      
      .auth-tab.active {
        background: var(--primary-green);
        color: white;
      }
      
      .auth-tab:hover:not(.active) {
        color: var(--text-primary);
      }
      
      /* Forms */
      .form-group {
        margin-bottom: var(--spacing-md);
      }
      
      .form-label {
        display: block;
        margin-bottom: var(--spacing-sm);
        color: var(--text-secondary);
        font-weight: 500;
        font-size: 0.9rem;
      }
      
      .form-input {
        width: 100%;
        padding: var(--spacing-md);
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: 1rem;
        transition: all 0.2s ease;
      }
      
      .form-input:focus {
        outline: none;
        border-color: var(--primary-green);
        box-shadow: 0 0 0 2px rgba(102, 187, 106, 0.2);
      }
      
      .form-input::placeholder {
        color: var(--text-secondary);
      }
      
      .form-button {
        width: 100%;
        padding: var(--spacing-md);
        background: var(--primary-green);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: var(--spacing-sm);
      }
      
      .form-button:hover:not(:disabled) {
        background: var(--primary-green-light);
        transform: translateY(-1px);
      }
      
      .form-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      
      /* Main App Content */
      .app-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xl);
      }
      
      .welcome-card {
        background: var(--bg-dark-green);
        padding: var(--spacing-lg);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-green);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-md);
        position: relative;
      }
      
      .welcome-text {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      
      .welcome-user {
        color: var(--primary-green);
        font-weight: 600;
      }
      
      .welcome-dismiss {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        padding: var(--spacing-xs);
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
      }
      
      .welcome-dismiss:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary);
      }
      
      /* Player Tracking Section */
      .tracking-section {
        background: var(--bg-dark-green);
        padding: var(--spacing-xl);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-green);
      }
      
      .section-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-lg);
      }
      
      .section-title {
        color: var(--primary-green);
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
      }
      
      .section-icon {
        font-size: 1.5rem;
      }
      
      .add-player-form {
        background: var(--bg-green-gray);
        padding: var(--spacing-lg);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-xl);
      }
      
      .add-player-title {
        color: var(--text-primary);
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 var(--spacing-md) 0;
      }
      
      .input-group {
        display: flex;
        gap: var(--spacing-md);
      }
      
      .input-group .form-input {
        flex: 1;
      }
      
      .input-group .form-button {
        width: auto;
        padding: var(--spacing-md) var(--spacing-lg);
        margin-top: 0;
      }
      
      /* Players Table Container */
      .players-container {
        margin-top: var(--spacing-lg);
      }
      
      /* Bulk Actions Bar */
      .bulk-actions {
        background: var(--bg-green-gray);
        padding: var(--spacing-md);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .bulk-actions-count {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      
      .bulk-actions-buttons {
        display: flex;
        gap: var(--spacing-sm);
      }
      
      .bulk-action-btn {
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--primary-green);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .bulk-action-btn:hover {
        background: var(--primary-green-light);
      }
      
      .bulk-action-btn.secondary {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-green);
      }
      
      .bulk-action-btn.secondary:hover {
        background: var(--bg-green-gray);
        color: var(--text-primary);
      }
      
      /* Table Wrapper */
      .table-wrapper {
        overflow-x: auto;
        background: var(--bg-green-gray);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-green);
      }
      
      /* Players Table */
      .players-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .players-table thead {
        background: var(--bg-dark-green);
        border-bottom: 1px solid var(--border-green);
      }
      
      .players-table th {
        padding: var(--spacing-md) var(--spacing-lg);
        text-align: left;
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .players-table th.sortable {
        cursor: pointer;
        user-select: none;
        transition: color 0.2s ease;
      }
      
      .players-table th.sortable:hover {
        color: var(--primary-green);
      }
      
      .players-table th.sortable::after {
        content: '↕';
        margin-left: var(--spacing-xs);
        opacity: 0.5;
        font-size: 0.8em;
      }
      
      .players-table th.sortable.sort-asc::after {
        content: '↑';
        opacity: 1;
      }
      
      .players-table th.sortable.sort-desc::after {
        content: '↓';
        opacity: 1;
      }
      
      .players-table tbody tr {
        border-bottom: 1px solid var(--border-green);
        transition: background-color 0.2s ease;
      }
      
      .players-table tbody tr:hover {
        background: rgba(102, 187, 106, 0.1);
      }
      
      .players-table td {
        padding: var(--spacing-md) var(--spacing-lg);
        color: var(--text-primary);
        font-size: 0.95rem;
      }
      
      .checkbox-column {
        width: 40px;
        text-align: center;
      }
      
      .player-info-table {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }
      
      .player-avatar-small {
        font-size: 1.2rem;
      }
      
      .player-name {
        color: var(--text-primary);
        font-weight: 600;
      }
      
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-xs) var(--spacing-sm);
        background: rgba(76, 175, 80, 0.2);
        color: var(--success-green);
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
        font-weight: 500;
      }
      
      .status-badge.inactive {
        background: rgba(255, 152, 0, 0.2);
        color: var(--warning-amber);
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        background: currentColor;
        border-radius: 50%;
      }
      
      .actions-cell {
        text-align: left;
        min-width: 280px;
        padding-left: var(--spacing-md);
      }
      
      /* Action Buttons Container */
      .action-buttons {
        display: flex;
        gap: var(--spacing-xs);
        justify-content: flex-start;
        flex-wrap: nowrap;
      }
      
      .action-btn {
        padding: 6px 12px;
        background: var(--primary-green);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-width: 85px;
        justify-content: center;
      }
      
      .action-btn:hover {
        background: var(--primary-green-light);
      }
      
      .action-btn.secondary {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-green);
      }
      
      .action-btn.secondary:hover {
        background: var(--bg-green-gray);
        color: var(--error-red);
        border-color: var(--error-red);
      }
      
      .action-btn.alert {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-gray);
      }
      
      .action-btn.alert:hover {
        background: var(--bg-green-gray);
        color: var(--primary-green);
        border-color: var(--primary-green);
      }
      
      .action-btn.alert.active {
        background: var(--primary-green);
        color: white;
        border-color: var(--primary-green);
      }
      
      .action-btn.alert.active:hover {
        background: var(--primary-green-light);
        border-color: var(--primary-green-light);
      }
      
      .action-btn.outline {
        background: transparent;
        color: var(--primary-green);
        border: 1px solid var(--primary-green);
      }
      
      .action-btn.outline:hover {
        background: var(--primary-green);
        color: white;
        border-color: var(--primary-green);
      }
      
      /* Loading and Error States */
      .loading-cell, .error-cell {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--text-secondary);
      }
      
      .error-cell {
        color: var(--error-red);
      }
      
      .error-message {
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid var(--error-red);
        border-radius: 4px;
        padding: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        color: var(--error-red);
        font-size: 0.9rem;
        text-align: center;
      }
      
      .empty-state {
        text-align: center;
        padding: var(--spacing-xl);
        color: var(--text-secondary);
      }
      
      .empty-state-icon {
        font-size: 3rem;
        margin-bottom: var(--spacing-md);
        opacity: 0.5;
      }
      
      .empty-state-text {
        font-size: 1.1rem;
        margin-bottom: var(--spacing-sm);
      }
      
      .empty-state-subtext {
        font-size: 0.9rem;
        opacity: 0.7;
      }
      
      /* Utility Classes */
      .hidden {
        display: none !important;
      }
      
      .loading {
        opacity: 0.6;
      }
      
      /* Screen reader only content */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      
      /* Wide Screen Enhancements */
      @media (min-width: 1000px) {
        .players-table th,
        .players-table td {
          padding: var(--spacing-lg);
        }
        
        .action-btn {
          padding: 8px 16px;
          font-size: 0.875rem;
          min-width: 90px;
        }
      }
      
      /* Responsive Design */
      @media (max-width: 768px) {
        .header {
          padding: var(--spacing-md);
        }
        
        .header-content {
          flex-direction: column;
          gap: var(--spacing-md);
          align-items: stretch;
        }
        
        .nav-user {
          justify-content: space-between;
        }
        
        .main-layout {
          padding: var(--spacing-md);
        }
        
        .auth-container {
          padding: var(--spacing-lg);
        }
        
        .input-group {
          flex-direction: column;
        }
        
        .input-group .form-button {
          width: 100%;
        }
        
        .players-table {
          font-size: 0.85rem;
        }
        
        .players-table th,
        .players-table td {
          padding: var(--spacing-sm);
        }
        
        .action-btn {
          padding: var(--spacing-xs);
          font-size: 0.75rem;
        }
        
        .welcome-card {
          flex-direction: column;
          text-align: center;
          position: relative;
        }
        
        .welcome-dismiss {
          position: absolute;
          top: var(--spacing-sm);
          right: var(--spacing-sm);
        }
      }
      
      @media (max-width: 480px) {
        .header {
          padding: var(--spacing-sm);
        }
        
        .main-layout {
          padding: var(--spacing-sm);
        }
        
        .auth-container {
          padding: var(--spacing-md);
        }
        
        .tracking-section {
          padding: var(--spacing-md);
        }
        
        .add-player-form {
          padding: var(--spacing-md);
        }
      }
      
      /* Phase 4: Notification Management UI Styles */
      
      /* App Navigation Tabs */
      .app-navigation {
        display: flex;
        margin-bottom: var(--spacing-xl);
        background: var(--bg-green-gray);
        border-radius: var(--radius-md);
        padding: var(--spacing-xs);
        border: 1px solid var(--border-green);
      }
      
      .app-tab {
        flex: 1;
        padding: var(--spacing-md) var(--spacing-lg);
        text-align: center;
        background: transparent;
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--text-secondary);
        font-weight: 600;
        font-size: 0.95rem;
      }
      
      .app-tab.active {
        background: var(--primary-green);
        color: white;
        box-shadow: 0 2px 4px rgba(102, 187, 106, 0.3);
      }
      
      .app-tab:hover:not(.active) {
        color: var(--text-primary);
        background: rgba(102, 187, 106, 0.1);
      }
      
      /* Tab Content */
      .tab-content {
        width: 100%;
      }
      
      .tab-content.hidden {
        display: none;
      }
      
      /* Notification Settings Styles */
      .notifications-section {
        width: 100%;
      }
      
      .notification-dashboard {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xl);
      }
      
      .dashboard-stats {
        display: flex;
        gap: var(--spacing-lg);
        flex-wrap: wrap;
        margin-top: var(--spacing-md);
      }
      
      .stat-card {
        background: var(--bg-green-gray);
        padding: var(--spacing-md);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-green);
        flex: 1;
        min-width: 150px;
      }
      
      .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary-green);
        display: block;
      }
      
      .stat-label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-top: var(--spacing-xs);
      }
      
      /* Settings Cards */
      .settings-card {
        background: var(--bg-dark-green);
        border: 1px solid var(--border-green);
        border-radius: var(--radius-lg);
        padding: var(--spacing-xl);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      .settings-title {
        color: var(--primary-green);
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 var(--spacing-lg) 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }
      
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--spacing-lg);
      }
      
      .setting-item {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }
      
      .setting-label {
        color: var(--text-primary);
        font-weight: 600;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }
      
      .setting-description {
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin: 0;
        line-height: 1.4;
      }
      
      .setting-checkbox {
        width: 18px;
        height: 18px;
        accent-color: var(--primary-green);
      }
      
      .setting-select,
      .setting-input {
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        color: var(--text-primary);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
        transition: border-color 0.2s ease;
      }
      
      .setting-select:focus,
      .setting-input:focus {
        outline: none;
        border-color: var(--primary-green);
        box-shadow: 0 0 0 2px rgba(102, 187, 106, 0.2);
      }
      
      .time-range {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }
      
      .time-separator {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      
      /* Player Settings */
      .player-settings {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }
      
      .player-setting-item {
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: all 0.2s ease;
      }
      
      .player-setting-item:hover {
        background: rgba(102, 187, 106, 0.05);
        border-color: var(--primary-green);
      }
      
      .player-setting-info {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }
      
      .player-setting-name {
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .player-setting-status {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      
      .player-setting-controls {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }
      
      .setting-toggle {
        background: transparent;
        border: 1px solid var(--border-green);
        color: var(--text-secondary);
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.85rem;
      }
      
      .setting-toggle.enabled {
        background: var(--primary-green);
        color: white;
        border-color: var(--primary-green);
      }
      
      .setting-toggle:hover {
        background: var(--primary-green);
        color: white;
      }
      
      /* Queue Status */
      .queue-status {
        display: flex;
        gap: var(--spacing-xl);
        flex-wrap: wrap;
      }
      
      .status-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-md);
        background: var(--bg-green-gray);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-green);
        flex: 1;
        min-width: 120px;
      }
      
      .status-label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .status-count {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary-green);
      }
      
      /* Analytics Styles */
      .analytics-section {
        width: 100%;
      }
      
      .history-filters {
        display: flex;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
        flex-wrap: wrap;
      }
      
      .filter-select,
      .filter-input {
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        color: var(--text-primary);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
      }
      
      .notification-history {
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      
      .history-item {
        padding: var(--spacing-md);
        border-bottom: 1px solid var(--border-green);
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background-color 0.2s ease;
      }
      
      .history-item:hover {
        background: rgba(102, 187, 106, 0.05);
      }
      
      .history-item:last-child {
        border-bottom: none;
      }
      
      .history-info {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }
      
      .history-title {
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .history-details {
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
      
      .history-status {
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .history-status.sent {
        background: rgba(76, 175, 80, 0.2);
        color: var(--success-green);
      }
      
      .history-status.delivered {
        background: rgba(76, 175, 80, 0.3);
        color: var(--success-green);
      }
      
      .history-status.failed {
        background: rgba(244, 67, 54, 0.2);
        color: var(--error-red);
      }
      
      .history-status.clicked {
        background: rgba(102, 187, 106, 0.2);
        color: var(--primary-green);
      }
      
      .analytics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--spacing-lg);
      }
      
      .analytics-card {
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        text-align: center;
      }
      
      .analytics-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--primary-green);
        display: block;
        margin-bottom: var(--spacing-xs);
      }
      
      .analytics-label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .bulk-player-actions {
        display: flex;
        gap: var(--spacing-md);
        justify-content: center;
        flex-wrap: wrap;
      }
      
      /* Pagination */
      .pagination {
        display: flex;
        justify-content: center;
        gap: var(--spacing-sm);
        margin-top: var(--spacing-lg);
      }
      
      .pagination-btn {
        background: var(--bg-green-gray);
        border: 1px solid var(--border-green);
        color: var(--text-primary);
        padding: var(--spacing-sm) var(--spacing-md);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
      }
      
      .pagination-btn:hover:not(.disabled) {
        background: var(--primary-green);
        color: white;
      }
      
      .pagination-btn.active {
        background: var(--primary-green);
        color: white;
      }
      
      .pagination-btn.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      /* Enhanced Mobile Optimization and Accessibility */
      
      /* Touch-friendly interactions */
      .form-button,
      .nav-button,
      .app-tab,
      .action-btn,
      .bulk-action-btn,
      .pagination-btn {
        min-height: 44px; /* Apple's minimum touch target */
        min-width: 44px;
        touch-action: manipulation; /* Prevent zoom on touch */
      }
      
      /* Improved focus states for accessibility */
      .form-input:focus,
      .form-button:focus,
      .nav-button:focus,
      .app-tab:focus,
      .action-btn:focus,
      .setting-checkbox:focus,
      .setting-select:focus {
        outline: 2px solid var(--primary-green);
        outline-offset: 2px;
      }
      
      /* Skip to content link for screen readers */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--primary-green);
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 1000;
        border-radius: 4px;
      }
      
      .skip-link:focus {
        top: 6px;
      }
      
      /* Enhanced mobile table handling */
      @media (max-width: 640px) {
        .players-table {
          display: block;
          width: 100%;
          overflow-x: auto;
          white-space: nowrap;
        }
        
        .players-table thead {
          display: none; /* Hide headers on mobile */
        }
        
        .players-table tbody {
          display: block;
        }
        
        .players-table tr {
          display: block;
          border: 1px solid var(--border-green);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--bg-green-gray);
        }
        
        .players-table td {
          display: block;
          text-align: left;
          padding: var(--spacing-xs) 0;
          border: none;
        }
        
        .players-table td:before {
          content: attr(data-label) ": ";
          font-weight: 600;
          color: var(--text-secondary);
        }
        
        .checkbox-column {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .checkbox-column:before {
          content: "Select";
        }
      }
      
      /* Mobile-optimized form layouts */
      @media (max-width: 480px) {
        .time-range {
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        
        .time-separator {
          align-self: center;
        }
        
        .input-group {
          gap: var(--spacing-sm);
        }
        
        .bulk-actions {
          flex-direction: column;
          gap: var(--spacing-sm);
          text-align: center;
        }
        
        .bulk-actions-buttons {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
      }
      
      /* Responsive Design for Phase 4 */
      @media (min-width: 1000px) {
        .settings-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        
        .dashboard-stats {
          justify-content: space-between;
        }
        
        .app-navigation {
          max-width: 600px;
          margin: 0 auto var(--spacing-xl) auto;
        }
      }
      
      @media (max-width: 768px) {
        .app-tab {
          padding: var(--spacing-md) var(--spacing-sm);
          font-size: 0.9rem;
          flex: 1;
          min-width: 0; /* Allow shrinking */
        }
        
        .app-navigation {
          margin-bottom: var(--spacing-lg);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        .settings-grid {
          grid-template-columns: 1fr;
          gap: var(--spacing-md);
        }
        
        .dashboard-stats {
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        
        .queue-status {
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        
        .history-filters {
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        
        .analytics-grid {
          grid-template-columns: 1fr;
        }
        
        .player-setting-item {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-md);
        }
        
        .player-setting-controls {
          width: 100%;
          justify-content: space-between;
        }
        
        .notification-history {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .history-item {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--spacing-sm);
        }
        
        .pagination {
          flex-wrap: wrap;
          gap: var(--spacing-xs);
        }
        
        .pagination-btn {
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: 0.8rem;
        }
      }
      
      /* Extra small devices */
      @media (max-width: 380px) {
        .app-tab {
          font-size: 0.8rem;
          padding: var(--spacing-sm) var(--spacing-xs);
        }
        
        .settings-card {
          padding: var(--spacing-md);
        }
        
        .form-input,
        .setting-select,
        .filter-select,
        .filter-input {
          font-size: 16px; /* Prevent zoom on iOS */
        }
      }
      
      /* Reduce motion for users who prefer it */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :root {
          --border-green: #ffffff;
          --text-secondary: #ffffff;
        }
      }
      
      /* Dark mode improvements */
      @media (prefers-color-scheme: dark) {
        .form-input,
        .setting-select,
        .filter-select {
          color-scheme: dark;
        }
      }
    </style>
</head>
<body>
    <!-- Skip to content link for accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>
    
    <!-- Header Navigation -->
    <header class="header" role="banner">
        <div class="header-content">
            <a href="/" class="logo" aria-label="Chesscom Helper - Home">
                <img src="/majestic-knight-small.png" alt="Chesscom Helper Logo" class="logo-icon">
                <div class="logo-text">
                    <span class="logo-title">Chesscom Helper</span>
                    <span class="logo-tagline">your chesstest friend</span>
                </div>
            </a>
            
            <!-- Navigation for unauthenticated users -->
            <nav id="authNav" class="nav-user auth-nav" role="navigation" aria-label="Authentication navigation">
                <button class="nav-button secondary" onclick="switchTab('login')" aria-describedby="auth-help">Login</button>
                <button class="nav-button" onclick="switchTab('register')" aria-describedby="auth-help">Register</button>
            </nav>
            
            <!-- Navigation for authenticated users -->
            <nav id="userNav" class="nav-user hidden" role="navigation" aria-label="User navigation">
                <div class="nav-user-info" role="status" aria-live="polite">
                    <span class="welcome">Welcome,</span>
                    <span class="username" id="navUsername">User</span>
                </div>
                <button class="nav-button secondary" onclick="logout()" aria-label="Sign out of your account">Logout</button>
            </nav>
        </div>
        <div id="auth-help" class="sr-only">Choose login to sign into your existing account or register to create a new account</div>
    </header>
    
    <!-- Main Content -->
    <main class="main-layout" id="main-content" role="main">
        <div class="container">
            <!-- Authentication Section -->
            <section id="authSection" class="auth-container" aria-labelledby="auth-title">
                <div class="auth-header">
                    <h1 id="auth-title" class="auth-title">Welcome to Chesscom Helper</h1>
                    <p class="auth-subtitle">Track your favorite Chess.com players</p>
                </div>
                
                <div class="auth-tabs" role="tablist" aria-label="Authentication method">
                    <button class="auth-tab active" onclick="switchTab('login')" role="tab" aria-selected="true" aria-controls="loginForm" id="login-tab">Login</button>
                    <button class="auth-tab" onclick="switchTab('register')" role="tab" aria-selected="false" aria-controls="registerForm" id="register-tab">Register</button>
                </div>
                
                <!-- Login Form -->
                <form id="loginForm" class="auth-form" role="tabpanel" aria-labelledby="login-tab" novalidate>
                    <div id="loginError" class="error-message hidden" role="alert" aria-live="assertive"></div>
                    <div class="form-group">
                        <label class="form-label" for="loginEmail">Email Address</label>
                        <input type="email" id="loginEmail" class="form-input" placeholder="Enter your email" required 
                               aria-describedby="loginEmailHelp" autocomplete="email">
                        <div id="loginEmailHelp" class="sr-only">Enter your registered email address</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="loginPassword">Password</label>
                        <input type="password" id="loginPassword" class="form-input" placeholder="Enter your password" required
                               aria-describedby="loginPasswordHelp" autocomplete="current-password">
                        <div id="loginPasswordHelp" class="sr-only">Enter your account password</div>
                    </div>
                    <button type="submit" class="form-button" aria-describedby="login-submit-help">Sign In</button>
                    <div id="login-submit-help" class="sr-only">Sign in to access your player tracking dashboard</div>
                </form>
                
                <!-- Register Form -->
                <form id="registerForm" class="auth-form hidden" role="tabpanel" aria-labelledby="register-tab" novalidate>
                    <div id="registerError" class="error-message hidden" role="alert" aria-live="assertive"></div>
                    <div class="form-group">
                        <label class="form-label" for="registerEmail">Email Address</label>
                        <input type="email" id="registerEmail" class="form-input" placeholder="Enter your email" required
                               aria-describedby="registerEmailHelp" autocomplete="email">
                        <div id="registerEmailHelp" class="sr-only">Enter a valid email address for your new account</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="registerPassword">Password</label>
                        <input type="password" id="registerPassword" class="form-input" placeholder="Create a password" required
                               aria-describedby="registerPasswordHelp" autocomplete="new-password" minlength="8">
                        <div id="registerPasswordHelp" class="sr-only">Password must be at least 8 characters long</div>
                    </div>
                    <button type="submit" class="form-button" aria-describedby="register-submit-help">Create Account</button>
                    <div id="register-submit-help" class="sr-only">Create a new account to start tracking Chess.com players</div>
                </form>
            </section>
            
            <!-- Main Application -->
            <section id="mainApp" class="app-content hidden">
                <div class="welcome-card" id="welcomeCard">
                    <div>
                        <div class="welcome-text">
                            Welcome back, <span class="welcome-user" id="currentUser">User</span>!
                        </div>
                    </div>
                    <button class="welcome-dismiss" onclick="dismissWelcome()" title="Dismiss">×</button>
                </div>
                
                <!-- Main App Navigation -->
                <div class="app-navigation" role="tablist" aria-label="Main application sections">
                    <button class="app-tab active" onclick="switchAppTab('players')" role="tab" 
                            aria-selected="true" aria-controls="playersTab" id="players-tab">Players</button>
                    <button class="app-tab" onclick="switchAppTab('notifications')" role="tab" 
                            aria-selected="false" aria-controls="notificationsTab" id="notifications-tab">Notifications</button>
                    <button class="app-tab" onclick="switchAppTab('analytics')" role="tab" 
                            aria-selected="false" aria-controls="analyticsTab" id="analytics-tab">Analytics</button>
                </div>
                
                <!-- Players Tab Content -->
                <div id="playersTab" class="tab-content" role="tabpanel" aria-labelledby="players-tab">
                    <div class="tracking-section">
                        <div class="section-header">
                            <h2 class="section-title">Player Tracking</h2>
                        </div>
                    
                    <div class="add-player-form">
                        <h3 class="add-player-title">Add New Player</h3>
                        <form id="playerForm">
                            <div class="input-group">
                                <input type="text" id="username" class="form-input" 
                                       placeholder="Enter Chess.com username (e.g., MagnusCarlsen)" required>
                                <button type="submit" class="form-button">Start Monitoring</button>
                            </div>
                        </form>
                    </div>
                    
                    <div class="players-container">
                        <!-- Bulk Actions Bar -->
                        <div class="bulk-actions hidden" id="bulkActions">
                            <span class="bulk-actions-count">
                                <span id="selectedCount">0</span> selected
                            </span>
                            <div class="bulk-actions-buttons">
                                <button class="bulk-action-btn" onclick="bulkRemove()">Remove Selected</button>
                                <button class="bulk-action-btn secondary" onclick="clearSelection()">Clear Selection</button>
                            </div>
                        </div>
                        
                        <!-- Table Wrapper for horizontal scroll -->
                        <div class="table-wrapper">
                            <table id="playersTable" class="players-table">
                                <thead>
                                    <tr>
                                        <th class="checkbox-column">
                                            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()" 
                                                   aria-label="Select all players">
                                        </th>
                                        <th class="sortable" data-sort="player">
                                            <button class="sort-button" onclick="sortTable('player')" 
                                                    aria-label="Sort by player name">Player</button>
                                        </th>
                                        <th class="sortable" data-sort="lastSeen">
                                            <button class="sort-button" onclick="sortTable('lastSeen')" 
                                                    aria-label="Sort by last seen date">Last Seen on Chess.com</button>
                                        </th>
                                        <th>Alerts</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="playersList">
                                    <!-- Players will be loaded here -->
                                </tbody>
                            </table>
                            
                            <!-- Empty State -->
                            <div class="empty-state hidden" id="emptyState">
                                <div class="empty-state-icon"></div>
                                <div class="empty-state-text">No players monitored yet</div>
                                <div class="empty-state-subtext">Add a Chess.com username above to start tracking</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Notifications Tab Content -->
            <div id="notificationsTab" class="tab-content hidden" role="tabpanel" aria-labelledby="notifications-tab">
                <div class="notifications-section">
                    <!-- Notification Settings Dashboard -->
                    <div class="notification-dashboard">
                        <div class="section-header">
                            <h2 class="section-title">Notification Settings</h2>
                            <div class="dashboard-stats" id="dashboardStats">
                                <!-- Stats will be loaded here -->
                            </div>
                        </div>
                        
                        <!-- Global Notification Settings -->
                        <div class="settings-card">
                            <h3 class="settings-title">Global Settings</h3>
                            <div class="settings-grid">
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="emailEnabled" class="setting-checkbox" onchange="updateGlobalSettings()">
                                        Email Notifications
                                    </label>
                                    <p class="setting-description">Receive email notifications for player activity</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">Notification Frequency</label>
                                    <select id="notificationFrequency" class="setting-select" onchange="updateGlobalSettings()">
                                        <option value="immediate">Immediate</option>
                                        <option value="digest_hourly">Hourly Digest</option>
                                        <option value="digest_daily">Daily Digest</option>
                                        <option value="disabled">Disabled</option>
                                    </select>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">Quiet Hours</label>
                                    <div class="time-range">
                                        <input type="time" id="quietHoursStart" class="setting-input" onchange="updateGlobalSettings()">
                                        <span class="time-separator">to</span>
                                        <input type="time" id="quietHoursEnd" class="setting-input" onchange="updateGlobalSettings()">
                                    </div>
                                    <p class="setting-description">No notifications during these hours</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">Timezone</label>
                                    <select id="timezone" class="setting-select" onchange="updateGlobalSettings()">
                                        <option value="UTC">UTC</option>
                                        <option value="America/New_York">Eastern Time</option>
                                        <option value="America/Chicago">Central Time</option>
                                        <option value="America/Denver">Mountain Time</option>
                                        <option value="America/Los_Angeles">Pacific Time</option>
                                        <option value="Europe/London">London</option>
                                        <option value="Europe/Paris">Paris</option>
                                        <option value="Asia/Tokyo">Tokyo</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Player-Specific Settings -->
                        <div class="settings-card">
                            <h3 class="settings-title">Player-Specific Settings</h3>
                            <div class="player-settings" id="playerSettings">
                                <!-- Player settings will be loaded here -->
                            </div>
                            <div class="bulk-player-actions">
                                <button class="bulk-action-btn" onclick="bulkEnableNotifications()">Enable All</button>
                                <button class="bulk-action-btn secondary" onclick="bulkDisableNotifications()">Disable All</button>
                            </div>
                        </div>
                        
                        <!-- Real-time Status Monitor -->
                        <div class="settings-card">
                            <h3 class="settings-title">Notification Queue Status</h3>
                            <div class="queue-status" id="queueStatus">
                                <div class="status-item">
                                    <span class="status-label">Pending:</span>
                                    <span class="status-count" id="pendingCount">0</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">Processing:</span>
                                    <span class="status-count" id="processingCount">0</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">Sent (24h):</span>
                                    <span class="status-count" id="sentCount">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Analytics Tab Content -->
            <div id="analyticsTab" class="tab-content hidden" role="tabpanel" aria-labelledby="analytics-tab">
                <div class="analytics-section">
                    <div class="section-header">
                        <h2 class="section-title">Notification Analytics</h2>
                    </div>
                    
                    <!-- Notification History -->
                    <div class="settings-card">
                        <h3 class="settings-title">Recent Notifications</h3>
                        <div class="history-filters">
                            <select id="historyPlayerFilter" class="filter-select" onchange="loadNotificationHistory()">
                                <option value="">All Players</option>
                            </select>
                            <select id="historyStatusFilter" class="filter-select" onchange="loadNotificationHistory()">
                                <option value="">All Status</option>
                                <option value="sent">Sent</option>
                                <option value="delivered">Delivered</option>
                                <option value="failed">Failed</option>
                                <option value="clicked">Clicked</option>
                            </select>
                            <input type="date" id="historyStartDate" class="filter-input" onchange="loadNotificationHistory()">
                            <input type="date" id="historyEndDate" class="filter-input" onchange="loadNotificationHistory()">
                        </div>
                        <div class="notification-history" id="notificationHistory">
                            <!-- History will be loaded here -->
                        </div>
                        <div class="pagination" id="historyPagination">
                            <!-- Pagination will be loaded here -->
                        </div>
                    </div>
                    
                    <!-- Performance Analytics -->
                    <div class="settings-card">
                        <h3 class="settings-title">Performance Metrics</h3>
                        <div class="analytics-grid" id="analyticsGrid">
                            <!-- Analytics will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        </section>
        </div>
    </main>
    
    <script>
        // Simple auth state management
        let currentToken = localStorage.getItem('authToken');
        let currentUser = localStorage.getItem('currentUser');
        
        // Sorting state variables
        let currentSortColumn = 'player';
        let currentSortDirection = 'asc';
        
        // Initialize UI based on auth state
        function initAuth() {
            if (currentToken) {
                showMainApp();
            } else {
                showAuthSection();
            }
        }
        
        function showAuthSection() {
            document.getElementById('authSection').classList.remove('hidden');
            document.getElementById('mainApp').classList.add('hidden');
            document.getElementById('authNav').classList.remove('hidden');
            document.getElementById('userNav').classList.add('hidden');
        }
        
        function showMainApp() {
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('authNav').classList.add('hidden');
            document.getElementById('userNav').classList.remove('hidden');
            
            const username = currentUser || 'User';
            document.getElementById('currentUser').textContent = username;
            document.getElementById('navUsername').textContent = username;
            loadPlayers();
        }
        
        function switchTab(tab) {
            const tabs = document.querySelectorAll('.auth-tab');
            const loginForm = document.getElementById('loginForm');
            const registerForm = document.getElementById('registerForm');
            
            // Clear errors when switching tabs
            clearFormError('loginError');
            clearFormError('registerError');
            
            // Update ARIA states
            tabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            
            if (tab === 'login') {
                tabs[0].classList.add('active');
                tabs[0].setAttribute('aria-selected', 'true');
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                // Focus first input for accessibility
                setTimeout(() => document.getElementById('loginEmail').focus(), 100);
            } else {
                tabs[1].classList.add('active');
                tabs[1].setAttribute('aria-selected', 'true');
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
                // Focus first input for accessibility
                setTimeout(() => document.getElementById('registerEmail').focus(), 100);
            }
        }
        
        function logout() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            currentToken = null;
            currentUser = null;
            showAuthSection();
        }
        
        // Show loading state for buttons
        function setButtonLoading(button, isLoading, originalText = 'Submit') {
            if (isLoading) {
                button.disabled = true;
                button.textContent = 'Processing...';
                button.classList.add('loading');
            } else {
                button.disabled = false;
                button.textContent = originalText;
                button.classList.remove('loading');
            }
        }
        
        // Show error messages in auth forms
        function showNotification(message, type = 'info') {
            console.log(\`[\${type.toUpperCase()}] \${message}\`);
            
            if (type === 'error') {
                // Determine which form is currently visible
                const loginForm = document.getElementById('loginForm');
                const registerForm = document.getElementById('registerForm');
                
                if (!loginForm.classList.contains('hidden')) {
                    showFormError('loginError', message);
                } else if (!registerForm.classList.contains('hidden')) {
                    showFormError('registerError', message);
                }
            }
        }
        
        // Show error in specific form
        function showFormError(errorElementId, message) {
            const errorElement = document.getElementById(errorElementId);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.classList.remove('hidden');
            }
        }
        
        // Clear error from specific form
        function clearFormError(errorElementId) {
            const errorElement = document.getElementById(errorElementId);
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.classList.add('hidden');
            }
        }
        
        // Auth form handlers
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const button = this.querySelector('button');
            
            // Clear any existing errors
            clearFormError('loginError');
            
            setButtonLoading(button, true, 'Sign In');
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    currentToken = data.token;
                    currentUser = data.user.email;
                    localStorage.setItem('authToken', currentToken);
                    localStorage.setItem('currentUser', currentUser);
                    showMainApp();
                } else {
                    showNotification(data.error, 'error');
                }
            } catch (error) {
                showNotification('Login failed. Please try again.', 'error');
            } finally {
                setButtonLoading(button, false, 'Sign In');
            }
        });
        
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const button = this.querySelector('button');
            
            // Clear any existing errors
            clearFormError('registerError');
            
            setButtonLoading(button, true, 'Create Account');
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    currentToken = data.token;
                    currentUser = data.email;
                    localStorage.setItem('authToken', currentToken);
                    localStorage.setItem('currentUser', currentUser);
                    showMainApp();
                } else {
                    showNotification(data.error, 'error');
                }
            } catch (error) {
                showNotification('Registration failed. Please try again.', 'error');
            } finally {
                setButtonLoading(button, false, 'Create Account');
            }
        });
        
        // Helper function to format last seen date
        function formatLastSeen(lastSeenDate) {
            if (!lastSeenDate) return 'Just now';
            
            const now = new Date();
            const seen = new Date(lastSeenDate);
            const diffMs = now - seen;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return \`\${diffMins}m ago\`;
            if (diffHours < 24) return \`\${diffHours}h ago\`;
            return \`\${diffDays}d ago\`;
        }
        
        // Main sorting function
        function sortPlayers(players, column, direction) {
            return [...players].sort((a, b) => {
                let aVal, bVal;
                
                switch (column) {
                    case 'player':
                        aVal = a.toLowerCase();
                        bVal = b.toLowerCase();
                        break;
                    case 'lastSeen':
                        // Mock data - all players are "Just now" for now
                        aVal = new Date();
                        bVal = new Date();
                        break;
                    default:
                        return 0;
                }
                
                if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        async function loadPlayers() {
            const tbody = document.getElementById('playersList');
            const emptyState = document.getElementById('emptyState');
            const table = document.getElementById('playersTable');
            
            tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">Loading players...</td></tr>';
            
            // Update sort indicators
            const sortableHeaders = document.querySelectorAll('.sortable');
            sortableHeaders.forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc');
                if (header.dataset.sort === currentSortColumn) {
                    header.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
                }
            });
            
            try {
                const response = await fetch('/api/players', {
                    headers: {
                        'Authorization': \`Bearer \${currentToken}\`
                    }
                });
                const data = await response.json();
                
                if (data.players.length === 0) {
                    tbody.innerHTML = '';
                    table.style.display = 'none';
                    emptyState.classList.remove('hidden');
                } else {
                    table.style.display = 'table';
                    emptyState.classList.add('hidden');
                    
                    // Sort players based on current sort settings
                    const sortedPlayers = sortPlayers(data.players, currentSortColumn, currentSortDirection);
                    
                    tbody.innerHTML = sortedPlayers.map((player, index) => 
                        \`<tr>
                            <td class="checkbox-column">
                                <input type="checkbox" class="player-checkbox" data-player="\${player}" onchange="updateBulkActions()">
                            </td>
                            <td class="player-name-cell">
                                <div class="player-info-table">
                                    <span class="player-name">\${player}</span>
                                </div>
                            </td>
                            <td class="last-seen-cell">Just now</td>
                            <td class="alerts-cell">
                                <span class="status-badge">
                                    <span class="status-indicator"></span>
                                    Enabled
                                </span>
                            </td>
                            <td class="actions-cell">
                                <div class="action-buttons">
                                    <button class="action-btn outline" onclick="viewDetails('\${player}')">View Details</button>
                                    <button class="action-btn secondary" onclick="removePlayer('\${player}')">Remove</button>
                                </div>
                            </td>
                        </tr>\`
                    ).join('');
                }
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="5" class="error-cell">Error loading players. Please try refreshing the page.</td></tr>';
            }
        }
        
        document.getElementById('playerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const usernameInput = document.getElementById('username');
            const username = usernameInput.value.trim();
            const button = this.querySelector('button');
            
            if (!username) return;
            
            setButtonLoading(button, true, 'Start Monitoring');
            
            try {
                const response = await fetch('/api/monitor', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentToken}\`
                    },
                    body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showNotification(data.message, 'success');
                    usernameInput.value = '';
                    loadPlayers();
                } else {
                    showNotification(data.error, 'error');
                }
            } catch (error) {
                showNotification('Error connecting to server. Please try again.', 'error');
            } finally {
                setButtonLoading(button, false, 'Start Monitoring');
            }
        });
        
        // Table functionality functions (added to window for global access)
        window.toggleSelectAll = function() {
            const selectAll = document.getElementById('selectAll');
            const checkboxes = document.querySelectorAll('.player-checkbox');
            checkboxes.forEach(cb => cb.checked = selectAll.checked);
            updateBulkActions();
        }
        
        window.updateBulkActions = function() {
            const checkedBoxes = document.querySelectorAll('.player-checkbox:checked');
            const bulkActions = document.getElementById('bulkActions');
            const selectedCount = document.getElementById('selectedCount');
            
            if (checkedBoxes.length > 0) {
                bulkActions.classList.remove('hidden');
                selectedCount.textContent = checkedBoxes.length;
            } else {
                bulkActions.classList.add('hidden');
                document.getElementById('selectAll').checked = false;
            }
        }
        
        window.clearSelection = function() {
            document.getElementById('selectAll').checked = false;
            document.querySelectorAll('.player-checkbox').forEach(cb => cb.checked = false);
            updateBulkActions();
        }
        
        window.bulkRemove = async function() {
            const checkedBoxes = document.querySelectorAll('.player-checkbox:checked');
            const players = Array.from(checkedBoxes).map(cb => cb.dataset.player);
            
            // TODO: Implement bulk remove API
            showNotification(\`Removed \${players.length} player(s)\`, 'success');
            clearSelection();
            loadPlayers();
        }
        
        window.removePlayer = async function(username) {
            // TODO: Implement remove API
            showNotification(\`Stopped monitoring \${username}\`, 'success');
            loadPlayers();
        }
        
        
        window.viewDetails = function(username) {
            // Phase 1: Show coming soon notification
            showNotification('Player details coming soon!', 'info');
        }
        
        window.toggleAlert = function(username) {
            // Find the alert button for this player
            const buttons = document.querySelectorAll('.action-btn.alert');
            let targetButton = null;
            
            buttons.forEach(button => {
                if (button.getAttribute('onclick') === \`toggleAlert('\${username}')\`) {
                    targetButton = button;
                }
            });
            
            if (targetButton) {
                // Toggle the active class
                const isActive = targetButton.classList.toggle('active');
                
                // Show appropriate notification
                if (isActive) {
                    showNotification(\`Alert notifications enabled for \${username}\`, 'success');
                } else {
                    showNotification(\`Alert notifications disabled for \${username}\`, 'info');
                }
                
                // TODO: In the future, this would persist the alert preference to the backend
            }
        }
        
        // Table sorting
        document.addEventListener('DOMContentLoaded', function() {
            const sortableHeaders = document.querySelectorAll('.sortable');
            sortableHeaders.forEach(header => {
                header.addEventListener('click', function() {
                    const sortKey = this.dataset.sort;
                    
                    // If clicking the same column, toggle direction
                    if (currentSortColumn === sortKey) {
                        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        // If clicking a different column, reset to ascending
                        currentSortColumn = sortKey;
                        currentSortDirection = 'asc';
                    }
                    
                    // Remove sorting classes from all headers
                    sortableHeaders.forEach(h => {
                        h.classList.remove('sort-asc', 'sort-desc');
                    });
                    
                    // Add appropriate class to clicked header
                    this.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
                    
                    // Re-render the table with sorted data
                    loadPlayers();
                });
            });
        });
        
        // Welcome card dismiss functionality
        window.dismissWelcome = function() {
            const welcomeCard = document.getElementById('welcomeCard');
            if (welcomeCard) {
                welcomeCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                welcomeCard.style.opacity = '0';
                welcomeCard.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    welcomeCard.style.display = 'none';
                    // Remember the user's preference
                    localStorage.setItem('welcomeCardDismissed', 'true');
                }, 300);
            }
        }
        
        // Check if welcome card should be hidden on load
        function checkWelcomeCardVisibility() {
            const dismissed = localStorage.getItem('welcomeCardDismissed');
            if (dismissed === 'true') {
                const welcomeCard = document.getElementById('welcomeCard');
                if (welcomeCard) {
                    welcomeCard.style.display = 'none';
                }
            }
        }
        
        // =============================================================================
        // PHASE 4: Notification Management JavaScript Functions
        // =============================================================================
        
        // Current app tab state
        let currentAppTab = 'players';
        
        // Notification preferences state
        let notificationPreferences = null;
        let playerSettings = [];
        let notificationHistory = [];
        let currentHistoryPage = 0;
        let historyFilters = {};
        
        // Tab switching functionality
        function switchAppTab(tab) {
            const tabs = document.querySelectorAll('.app-tab');
            const tabContents = document.querySelectorAll('.tab-content');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.add('hidden'));
            
            const activeTab = document.querySelector(\`[onclick="switchAppTab('\${tab}')"]\`);
            const activeContent = document.getElementById(\`\${tab}Tab\`);
            
            if (activeTab && activeContent) {
                activeTab.classList.add('active');
                activeContent.classList.remove('hidden');
                currentAppTab = tab;
                
                // Load content for the active tab
                if (tab === 'notifications') {
                    loadNotificationSettings();
                } else if (tab === 'analytics') {
                    loadNotificationAnalytics();
                }
            }
        }
        
        // Load notification settings
        async function loadNotificationSettings() {
            try {
                // Load dashboard stats
                await loadDashboardStats();
                
                // Load notification preferences
                await loadNotificationPreferences();
                
                // Load player-specific settings
                await loadPlayerNotificationSettings();
                
                // Load queue status
                await loadQueueStatus();
                
                // Set up real-time updates
                startRealTimeUpdates();
                
            } catch (error) {
                console.error('Error loading notification settings:', error);
            }
        }
        
        // Load dashboard statistics
        async function loadDashboardStats() {
            try {
                const response = await fetch('/api/v1/notifications/dashboard/stats', {
                    headers: { 'Authorization': \`Bearer \${currentToken}\` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    updateDashboardStats(data.stats);
                }
            } catch (error) {
                console.error('Error loading dashboard stats:', error);
            }
        }
        
        function updateDashboardStats(stats) {
            const statsContainer = document.getElementById('dashboardStats');
            if (statsContainer) {
                statsContainer.innerHTML = \`
                    <div class="stat-card">
                        <span class="stat-value">\${stats.totalPlayers}</span>
                        <span class="stat-label">Total Players</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">\${stats.enabledPlayers}</span>
                        <span class="stat-label">Enabled Players</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">\${stats.notifications24h}</span>
                        <span class="stat-label">24h Notifications</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">\${stats.pendingNotifications}</span>
                        <span class="stat-label">Pending</span>
                    </div>
                \`;
            }
        }
        
        // Load notification preferences
        async function loadNotificationPreferences() {
            try {
                const response = await fetch('/api/v1/notifications/preferences/v2', {
                    headers: { 'Authorization': \`Bearer \${currentToken}\` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    notificationPreferences = data.preferences;
                    updatePreferencesForm(data.preferences);
                } else {
                    // Create default preferences if they don't exist
                    notificationPreferences = {
                        emailEnabled: true,
                        notificationFrequency: 'immediate',
                        quietHoursStart: '22:00',
                        quietHoursEnd: '07:00',
                        timezone: 'UTC'
                    };
                    updatePreferencesForm(notificationPreferences);
                }
            } catch (error) {
                console.error('Error loading notification preferences:', error);
            }
        }
        
        function updatePreferencesForm(preferences) {
            if (preferences) {
                document.getElementById('emailEnabled').checked = preferences.emailEnabled;
                document.getElementById('notificationFrequency').value = preferences.notificationFrequency;
                document.getElementById('quietHoursStart').value = preferences.quietHoursStart;
                document.getElementById('quietHoursEnd').value = preferences.quietHoursEnd;
                document.getElementById('timezone').value = preferences.timezone;
            }
        }
        
        // Update global notification settings
        async function updateGlobalSettings() {
            try {
                const preferences = {
                    emailEnabled: document.getElementById('emailEnabled').checked,
                    notificationFrequency: document.getElementById('notificationFrequency').value,
                    quietHoursStart: document.getElementById('quietHoursStart').value,
                    quietHoursEnd: document.getElementById('quietHoursEnd').value,
                    timezone: document.getElementById('timezone').value
                };
                
                const response = await fetch('/api/v1/notifications/preferences/v2', {
                    method: 'PUT',
                    headers: {
                        'Authorization': \`Bearer \${currentToken}\`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(preferences)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    notificationPreferences = data.preferences;
                    showToast('Settings updated successfully', 'success');
                } else {
                    showToast('Failed to update settings', 'error');
                }
            } catch (error) {
                console.error('Error updating global settings:', error);
                showToast('Failed to update settings', 'error');
            }
        }
        
        // Load player-specific notification settings
        async function loadPlayerNotificationSettings() {
            try {
                const response = await fetch('/api/v1/notifications/players', {
                    headers: { 'Authorization': \`Bearer \${currentToken}\` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    playerSettings = data.settings;
                    updatePlayerSettingsDisplay(data.settings);
                }
            } catch (error) {
                console.error('Error loading player settings:', error);
            }
        }
        
        function updatePlayerSettingsDisplay(settings) {
            const container = document.getElementById('playerSettings');
            if (!container) return;
            
            if (settings.length === 0) {
                container.innerHTML = '<p class="setting-description">No player-specific settings configured yet.</p>';
                return;
            }
            
            container.innerHTML = settings.map(setting => \`
                <div class="player-setting-item">
                    <div class="player-setting-info">
                        <span class="player-setting-name">\${setting.playerName}</span>
                        <span class="player-setting-status">
                            \${setting.enabled ? 'Notifications enabled' : 'Notifications disabled'}
                        </span>
                    </div>
                    <div class="player-setting-controls">
                        <button class="setting-toggle \${setting.enabled ? 'enabled' : ''}" 
                                onclick="togglePlayerNotifications('\${setting.playerName}', \${!setting.enabled})">
                            \${setting.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                </div>
            \`).join('');
        }
        
        // Toggle player notification settings
        async function togglePlayerNotifications(playerName, enabled) {
            try {
                const response = await fetch(\`/api/v1/notifications/players/\${encodeURIComponent(playerName)}\`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': \`Bearer \${currentToken}\`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ enabled })
                });
                
                if (response.ok) {
                    await loadPlayerNotificationSettings();
                    showToast(\`Notifications \${enabled ? 'enabled' : 'disabled'} for \${playerName}\`, 'success');
                } else {
                    showToast('Failed to update player settings', 'error');
                }
            } catch (error) {
                console.error('Error updating player settings:', error);
                showToast('Failed to update player settings', 'error');
            }
        }
        
        // Bulk notification operations
        async function bulkEnableNotifications() {
            await bulkPlayerOperation('enable');
        }
        
        async function bulkDisableNotifications() {
            await bulkPlayerOperation('disable');
        }
        
        async function bulkPlayerOperation(action) {
            try {
                const playerNames = playerSettings.map(setting => setting.playerName);
                
                const response = await fetch('/api/v1/notifications/players/bulk', {
                    method: 'POST',
                    headers: {
                        'Authorization': \`Bearer \${currentToken}\`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action,
                        playerNames
                    })
                });
                
                if (response.ok) {
                    await loadPlayerNotificationSettings();
                    showToast(\`Successfully \${action}d notifications for all players\`, 'success');
                } else {
                    showToast(\`Failed to \${action} notifications\`, 'error');
                }
            } catch (error) {
                console.error('Error in bulk operation:', error);
                showToast(\`Failed to \${action} notifications\`, 'error');
            }
        }
        
        // Load queue status
        async function loadQueueStatus() {
            try {
                const response = await fetch('/api/v1/notifications/queue/status', {
                    headers: { 'Authorization': \`Bearer \${currentToken}\` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    updateQueueStatus(data.status);
                }
            } catch (error) {
                console.error('Error loading queue status:', error);
            }
        }
        
        function updateQueueStatus(status) {
            document.getElementById('pendingCount').textContent = status.pending || 0;
            document.getElementById('processingCount').textContent = status.processing || 0;
            document.getElementById('sentCount').textContent = status.sent || 0;
        }
        
        // Real-time updates with Server-Sent Events
        let eventSource = null;
        let realTimeInterval = null;
        
        function startRealTimeUpdates() {
            // Try to use SSE for real-time updates
            if (typeof EventSource !== 'undefined' && currentToken) {
                try {
                    eventSource = new EventSource(\`/api/v1/notifications/stream?token=\${currentToken}\`, {
                        withCredentials: false
                    });
                    
                    // Add authorization header (for compatible browsers)
                    if (eventSource.readyState === EventSource.CONNECTING) {
                        // Some browsers don't support custom headers in EventSource
                        // Fall back to token in URL or use fetch-based SSE
                        eventSource.close();
                        startFetchBasedSSE();
                        return;
                    }
                    
                    eventSource.onopen = function(event) {
                        console.log('SSE connection opened');
                    };
                    
                    eventSource.onmessage = function(event) {
                        console.log('SSE message:', event.data);
                    };
                    
                    eventSource.addEventListener('queue-status', function(event) {
                        const status = JSON.parse(event.data);
                        updateQueueStatus(status);
                    });
                    
                    eventSource.addEventListener('dashboard-stats', function(event) {
                        const stats = JSON.parse(event.data);
                        updateDashboardStats(stats);
                    });
                    
                    eventSource.addEventListener('connected', function(event) {
                        console.log('SSE connected:', event.data);
                        showToast('Real-time updates connected', 'success');
                    });
                    
                    eventSource.addEventListener('heartbeat', function(event) {
                        console.log('SSE heartbeat:', event.data);
                    });
                    
                    eventSource.onerror = function(event) {
                        console.error('SSE error:', event);
                        if (eventSource.readyState === EventSource.CLOSED) {
                            console.log('SSE connection closed, falling back to polling');
                            startPollingUpdates();
                        }
                    };
                    
                } catch (error) {
                    console.error('Error starting SSE:', error);
                    startPollingUpdates();
                }
            } else {
                // Fallback to polling if SSE not supported
                startPollingUpdates();
            }
        }
        
        function startFetchBasedSSE() {
            // Fetch-based SSE for better header control
            const controller = new AbortController();
            
            fetch('/api/v1/notifications/stream', {
                headers: { 
                    'Authorization': \`Bearer \${currentToken}\`,
                    'Accept': 'text/event-stream'
                },
                signal: controller.signal
            }).then(response => {
                if (!response.ok) {
                    throw new Error(\`SSE request failed: \${response.status}\`);
                }
                
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('No response body reader');
                }
                
                const decoder = new TextDecoder();
                let buffer = '';
                
                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            console.log('SSE stream ended');
                            startPollingUpdates();
                            return;
                        }
                        
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\\n');
                        buffer = lines.pop() || '';
                        
                        let currentEvent = '';
                        let currentData = '';
                        
                        for (const line of lines) {
                            if (line.startsWith('event: ')) {
                                currentEvent = line.slice(7);
                            } else if (line.startsWith('data: ')) {
                                currentData = line.slice(6);
                            } else if (line === '' && currentEvent && currentData) {
                                handleSSEEvent(currentEvent, currentData);
                                currentEvent = '';
                                currentData = '';
                            }
                        }
                        
                        readStream();
                    }).catch(error => {
                        console.error('SSE read error:', error);
                        startPollingUpdates();
                    });
                }
                
                readStream();
                
            }).catch(error => {
                console.error('Fetch-based SSE error:', error);
                startPollingUpdates();
            });
            
            // Store controller for cleanup
            eventSource = { close: () => controller.abort() };
        }
        
        function handleSSEEvent(eventType, data) {
            try {
                const eventData = JSON.parse(data);
                
                switch (eventType) {
                    case 'queue-status':
                        updateQueueStatus(eventData);
                        break;
                    case 'dashboard-stats':
                        updateDashboardStats(eventData);
                        break;
                    case 'connected':
                        console.log('SSE connected:', eventData);
                        showToast('Real-time updates connected', 'success');
                        break;
                    case 'heartbeat':
                        console.log('SSE heartbeat:', eventData);
                        break;
                    default:
                        console.log('Unknown SSE event:', eventType, eventData);
                }
            } catch (error) {
                console.error('Error handling SSE event:', error);
            }
        }
        
        function startPollingUpdates() {
            // Fallback polling method
            console.log('Starting polling updates (SSE fallback)');
            realTimeInterval = setInterval(async () => {
                if (currentAppTab === 'notifications') {
                    await loadQueueStatus();
                    await loadDashboardStats();
                }
            }, 30000);
        }
        
        function stopRealTimeUpdates() {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            if (realTimeInterval) {
                clearInterval(realTimeInterval);
                realTimeInterval = null;
            }
        }
        
        // Load notification analytics
        async function loadNotificationAnalytics() {
            try {
                await loadNotificationHistory();
                await loadAnalyticsMetrics();
            } catch (error) {
                console.error('Error loading analytics:', error);
            }
        }
        
        // Load notification history
        async function loadNotificationHistory() {
            try {
                const params = new URLSearchParams({
                    limit: '20',
                    offset: (currentHistoryPage * 20).toString(),
                    ...historyFilters
                });
                
                const response = await fetch(\`/api/v1/notifications/history/v2?\${params}\`, {
                    headers: { 'Authorization': \`Bearer \${currentToken}\` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    notificationHistory = data.notifications;
                    updateHistoryDisplay(data.notifications);
                    updateHistoryPagination(data.pagination);
                    
                    // Populate player filter
                    updateHistoryPlayerFilter(data.notifications);
                }
            } catch (error) {
                console.error('Error loading notification history:', error);
            }
        }
        
        function updateHistoryDisplay(notifications) {
            const container = document.getElementById('notificationHistory');
            if (!container) return;
            
            if (notifications.length === 0) {
                container.innerHTML = '<div class="history-item"><div class="history-info"><span class="history-title">No notifications found</span></div></div>';
                return;
            }
            
            container.innerHTML = notifications.map(notification => \`
                <div class="history-item">
                    <div class="history-info">
                        <span class="history-title">\${notification.subject || 'Notification'}</span>
                        <span class="history-details">
                            \${notification.playerName} • \${new Date(notification.sentAt).toLocaleString()}
                        </span>
                    </div>
                    <span class="history-status \${notification.status}">\${notification.status}</span>
                </div>
            \`).join('');
        }
        
        function updateHistoryPlayerFilter(notifications) {
            const filter = document.getElementById('historyPlayerFilter');
            if (!filter) return;
            
            const players = [...new Set(notifications.map(n => n.playerName))];
            const currentValue = filter.value;
            
            filter.innerHTML = '<option value="">All Players</option>' + 
                players.map(player => \`<option value="\${player}">\${player}</option>\`).join('');
            
            filter.value = currentValue;
        }
        
        function updateHistoryPagination(pagination) {
            const container = document.getElementById('historyPagination');
            if (!container || !pagination) return;
            
            const totalPages = Math.ceil(pagination.totalCount / pagination.limit);
            const currentPage = Math.floor(pagination.offset / pagination.limit);
            
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }
            
            let paginationHTML = '';
            
            // Previous button
            paginationHTML += \`<button class="pagination-btn \${currentPage === 0 ? 'disabled' : ''}" 
                                        onclick="changeHistoryPage(\${currentPage - 1})" 
                                        \${currentPage === 0 ? 'disabled' : ''}>‹</button>\`;
            
            // Page numbers
            for (let i = Math.max(0, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
                paginationHTML += \`<button class="pagination-btn \${i === currentPage ? 'active' : ''}" 
                                          onclick="changeHistoryPage(\${i})">\${i + 1}</button>\`;
            }
            
            // Next button
            paginationHTML += \`<button class="pagination-btn \${currentPage === totalPages - 1 ? 'disabled' : ''}" 
                                        onclick="changeHistoryPage(\${currentPage + 1})" 
                                        \${currentPage === totalPages - 1 ? 'disabled' : ''}>›</button>\`;
            
            container.innerHTML = paginationHTML;
        }
        
        function changeHistoryPage(page) {
            currentHistoryPage = page;
            loadNotificationHistory();
        }
        
        // Load analytics metrics
        async function loadAnalyticsMetrics() {
            try {
                const endDate = new Date().toISOString().split('T')[0];
                const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                
                const params = new URLSearchParams({
                    startDate,
                    endDate,
                    groupBy: 'day'
                });
                
                const response = await fetch(\`/api/v1/notifications/analytics?\${params}\`, {
                    headers: { 'Authorization': \`Bearer \${currentToken}\` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    updateAnalyticsDisplay(data.analytics);
                }
            } catch (error) {
                console.error('Error loading analytics metrics:', error);
            }
        }
        
        function updateAnalyticsDisplay(analytics) {
            const container = document.getElementById('analyticsGrid');
            if (!container) return;
            
            // Calculate totals
            const totals = analytics.reduce((acc, day) => ({
                sent: acc.sent + day.totalNotificationsSent,
                delivered: acc.delivered + day.totalNotificationsDelivered,
                failed: acc.failed + day.totalNotificationsFailed,
                clicked: acc.clicked + day.totalNotificationsClicked
            }), { sent: 0, delivered: 0, failed: 0, clicked: 0 });
            
            const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0;
            const clickRate = totals.delivered > 0 ? Math.round((totals.clicked / totals.delivered) * 100) : 0;
            
            container.innerHTML = \`
                <div class="analytics-card">
                    <span class="analytics-value">\${totals.sent}</span>
                    <span class="analytics-label">Total Sent</span>
                </div>
                <div class="analytics-card">
                    <span class="analytics-value">\${totals.delivered}</span>
                    <span class="analytics-label">Delivered</span>
                </div>
                <div class="analytics-card">
                    <span class="analytics-value">\${deliveryRate}%</span>
                    <span class="analytics-label">Delivery Rate</span>
                </div>
                <div class="analytics-card">
                    <span class="analytics-value">\${clickRate}%</span>
                    <span class="analytics-label">Click Rate</span>
                </div>
            \`;
        }
        
        // Toast notification system
        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = \`toast toast-\${type}\`;
            toast.textContent = message;
            toast.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--\${type === 'success' ? 'success-green' : type === 'error' ? 'error-red' : 'primary-green'});
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                font-weight: 600;
                transition: all 0.3s ease;
                transform: translateX(100%);
            \`;
            
            document.body.appendChild(toast);
            
            // Animate in
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 10);
            
            // Remove after 4 seconds
            setTimeout(() => {
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 4000);
        }
        
        // Update history filters when changed
        window.loadNotificationHistory = function() {
            historyFilters = {
                playerName: document.getElementById('historyPlayerFilter')?.value || '',
                status: document.getElementById('historyStatusFilter')?.value || '',
                startDate: document.getElementById('historyStartDate')?.value || '',
                endDate: document.getElementById('historyEndDate')?.value || ''
            };
            
            // Remove empty filters
            Object.keys(historyFilters).forEach(key => {
                if (!historyFilters[key]) {
                    delete historyFilters[key];
                }
            });
            
            currentHistoryPage = 0;
            loadNotificationHistory();
        };
        
        // =============================================================================
        // MOBILE & ACCESSIBILITY ENHANCEMENTS
        // =============================================================================
        
        // Enhanced app tab switching with accessibility
        function switchAppTab(tabName) {
            const tabs = document.querySelectorAll('.app-tab');
            const contents = document.querySelectorAll('.tab-content');
            
            // Update ARIA states
            tabs.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });
            
            contents.forEach(content => {
                content.classList.add('hidden');
            });
            
            // Activate selected tab
            const activeTab = document.querySelector(`[onclick="switchAppTab('${tabName}')"]`);
            const activeContent = document.getElementById(`${tabName}Tab`);
            
            if (activeTab && activeContent) {
                activeTab.classList.add('active');
                activeTab.setAttribute('aria-selected', 'true');
                activeContent.classList.remove('hidden');
                
                // Focus management for accessibility
                const focusTarget = activeContent.querySelector('h2, .section-title');
                if (focusTarget) {
                    focusTarget.setAttribute('tabindex', '-1');
                    focusTarget.focus();
                }
            }
            
            // Update current tab and load content
            currentAppTab = tabName;
            
            if (tabName === 'notifications') {
                loadNotificationDashboard();
                startRealTimeUpdates();
            } else if (tabName === 'analytics') {
                loadNotificationAnalytics();
                stopRealTimeUpdates();
            } else {
                stopRealTimeUpdates();
            }
        }
        
        // Keyboard navigation for tabs
        function setupKeyboardNavigation() {
            const appTabs = document.querySelectorAll('.app-tab');
            
            appTabs.forEach((tab, index) => {
                tab.addEventListener('keydown', (e) => {
                    let targetIndex = index;
                    
                    switch (e.key) {
                        case 'ArrowLeft':
                            e.preventDefault();
                            targetIndex = index > 0 ? index - 1 : appTabs.length - 1;
                            break;
                        case 'ArrowRight':
                            e.preventDefault();
                            targetIndex = index < appTabs.length - 1 ? index + 1 : 0;
                            break;
                        case 'Home':
                            e.preventDefault();
                            targetIndex = 0;
                            break;
                        case 'End':
                            e.preventDefault();
                            targetIndex = appTabs.length - 1;
                            break;
                        default:
                            return;
                    }
                    
                    appTabs[targetIndex].focus();
                    appTabs[targetIndex].click();
                });
            });
        }
        
        // Touch gesture support for tab switching
        function setupTouchGestures() {
            const tabContainer = document.querySelector('.app-navigation');
            if (!tabContainer) return;
            
            let touchStartX = 0;
            let touchEndX = 0;
            
            tabContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });
            
            tabContainer.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipeGesture();
            }, { passive: true });
            
            function handleSwipeGesture() {
                const swipeThreshold = 50;
                const diff = touchStartX - touchEndX;
                
                if (Math.abs(diff) > swipeThreshold) {
                    const tabs = ['players', 'notifications', 'analytics'];
                    const currentIndex = tabs.indexOf(currentAppTab);
                    
                    if (diff > 0 && currentIndex < tabs.length - 1) {
                        // Swipe left - next tab
                        switchAppTab(tabs[currentIndex + 1]);
                    } else if (diff < 0 && currentIndex > 0) {
                        // Swipe right - previous tab
                        switchAppTab(tabs[currentIndex - 1]);
                    }
                }
            }
        }
        
        // Enhanced table sorting with accessibility
        function sortTable(columnKey) {
            const sortableHeaders = document.querySelectorAll('.sort-button');
            
            // Toggle sort direction
            if (currentSortColumn === columnKey) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = columnKey;
                currentSortDirection = 'asc';
            }
            
            // Update ARIA labels
            sortableHeaders.forEach(header => {
                const key = header.parentElement.dataset.sort;
                if (key === columnKey) {
                    const direction = currentSortDirection === 'asc' ? 'ascending' : 'descending';
                    header.setAttribute('aria-label', `Sort by ${key}, currently ${direction}`);
                    header.classList.add(`sort-${currentSortDirection}`);
                } else {
                    header.setAttribute('aria-label', `Sort by ${key}`);
                    header.classList.remove('sort-asc', 'sort-desc');
                }
            });
            
            // Reload with new sort
            loadPlayers();
        }
        
        // Mobile-friendly form validation
        function enhanceFormValidation() {
            const forms = document.querySelectorAll('form');
            
            forms.forEach(form => {
                const inputs = form.querySelectorAll('input');
                
                inputs.forEach(input => {
                    // Real-time validation feedback
                    input.addEventListener('blur', validateInput);
                    input.addEventListener('input', clearValidationError);
                    
                    // Prevent zoom on iOS
                    if (input.type === 'email' || input.type === 'password') {
                        input.style.fontSize = '16px';
                    }
                });
            });
        }
        
        function validateInput(e) {
            const input = e.target;
            const isValid = input.checkValidity();
            
            if (!isValid) {
                input.setAttribute('aria-invalid', 'true');
                showInputError(input, input.validationMessage);
            } else {
                input.setAttribute('aria-invalid', 'false');
                clearInputError(input);
            }
        }
        
        function showInputError(input, message) {
            const errorId = `${input.id}-error`;
            let errorEl = document.getElementById(errorId);
            
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.id = errorId;
                errorEl.className = 'input-error';
                errorEl.style.cssText = `
                    color: var(--error-red);
                    font-size: 0.8rem;
                    margin-top: 4px;
                `;
                input.parentNode.appendChild(errorEl);
            }
            
            errorEl.textContent = message;
            input.setAttribute('aria-describedby', errorId);
        }
        
        function clearInputError(input) {
            const errorId = `${input.id}-error`;
            const errorEl = document.getElementById(errorId);
            if (errorEl) {
                errorEl.remove();
            }
            input.removeAttribute('aria-describedby');
        }
        
        function clearValidationError(e) {
            const input = e.target;
            if (input.checkValidity()) {
                clearInputError(input);
                input.setAttribute('aria-invalid', 'false');
            }
        }
        
        // Responsive table enhancement for mobile
        function enhanceMobileTables() {
            const tables = document.querySelectorAll('.players-table');
            
            tables.forEach(table => {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
                
                // Add data-label attributes for mobile display
                const updateTableLabels = () => {
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        cells.forEach((cell, index) => {
                            if (headers[index]) {
                                cell.setAttribute('data-label', headers[index]);
                            }
                        });
                    });
                };
                
                // Update labels on load and when table content changes
                updateTableLabels();
                
                // Use MutationObserver to update labels when table content changes
                const observer = new MutationObserver(updateTableLabels);
                observer.observe(table.querySelector('tbody') || table, {
                    childList: true,
                    subtree: true
                });
            });
        }
        
        // Announce page changes to screen readers
        function announcePageChange(message) {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = message;
            
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        }
        
        // Handle viewport changes (orientation, keyboard)
        function handleViewportChanges() {
            let viewportHeight = window.innerHeight;
            
            window.addEventListener('resize', () => {
                const currentHeight = window.innerHeight;
                const heightDiff = viewportHeight - currentHeight;
                
                // Detect virtual keyboard on mobile
                if (heightDiff > 150) {
                    document.body.classList.add('keyboard-open');
                } else {
                    document.body.classList.remove('keyboard-open');
                }
                
                viewportHeight = currentHeight;
            });
        }
        
        // Initialize mobile enhancements
        function initMobileEnhancements() {
            setupKeyboardNavigation();
            setupTouchGestures();
            enhanceFormValidation();
            enhanceMobileTables();
            handleViewportChanges();
            
            // Add CSS for keyboard handling
            const style = document.createElement('style');
            style.textContent = `
                .keyboard-open {
                    height: 100vh;
                    overflow: hidden;
                }
                
                .keyboard-open .main-layout {
                    height: calc(100vh - 60px);
                    overflow-y: auto;
                }
                
                .sort-button {
                    background: none;
                    border: none;
                    color: inherit;
                    font: inherit;
                    cursor: pointer;
                    text-align: left;
                    width: 100%;
                    padding: 0;
                }
                
                .sort-button:hover {
                    color: var(--primary-green);
                }
                
                .sort-asc::after {
                    content: ' ↑';
                    color: var(--primary-green);
                }
                
                .sort-desc::after {
                    content: ' ↓';
                    color: var(--primary-green);
                }
            `;
            document.head.appendChild(style);
            
            console.log('Mobile and accessibility enhancements initialized');
        }
        
        // Make functions globally available
        window.switchAppTab = switchAppTab;
        window.updateGlobalSettings = updateGlobalSettings;
        window.togglePlayerNotifications = togglePlayerNotifications;
        window.bulkEnableNotifications = bulkEnableNotifications;
        window.bulkDisableNotifications = bulkDisableNotifications;
        window.changeHistoryPage = changeHistoryPage;
        window.sortTable = sortTable;
        
        // Initialize on page load
        initAuth();
        initMobileEnhancements();
        
        // Check welcome card visibility after DOM is ready
        setTimeout(checkWelcomeCardVisibility, 100);
    </script>
</body>
</html>`
}