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
          'Location': `https://raw.githubusercontent.com/emily-flambe/chesscom-helper/email-notifications/public/${imageName}`,
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
      
      /* GitHub Icon */
      .github-icon {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.3s ease;
        text-decoration: none;
      }
      
      .github-icon:hover {
        opacity: 1;
      }
      
      .github-icon svg {
        width: 24px;
        height: 24px;
        fill: var(--primary-green);
        transition: fill 0.3s ease;
      }
      
      .github-icon:hover svg {
        fill: var(--primary-green-light);
      }
      
      @media (max-width: 768px) {
        .github-icon {
          bottom: 16px;
          left: 16px;
        }
        
        .github-icon svg {
          width: 20px;
          height: 20px;
        }
      }
    </style>
</head>
<body>
    <!-- Header Navigation -->
    <header class="header">
        <div class="header-content">
            <a href="/" class="logo">
                <img src="/majestic-knight-small.png" alt="Chesscom Helper" class="logo-icon">
                <div class="logo-text">
                    <span class="logo-title">Chesscom Helper</span>
                    <span class="logo-tagline">your chesstest friend</span>
                </div>
            </a>
            
            <!-- Navigation for unauthenticated users -->
            <nav id="authNav" class="nav-user auth-nav">
                <button class="nav-button secondary" onclick="switchTab('login')">Login</button>
                <button class="nav-button" onclick="switchTab('register')">Register</button>
            </nav>
            
            <!-- Navigation for authenticated users -->
            <nav id="userNav" class="nav-user hidden">
                <div class="nav-user-info">
                    <span class="welcome">Welcome,</span>
                    <span class="username" id="navUsername">User</span>
                </div>
                <button class="nav-button secondary" onclick="logout()">Logout</button>
            </nav>
        </div>
    </header>
    
    <!-- Main Content -->
    <main class="main-layout">
        <div class="container">
            <!-- Authentication Section -->
            <section id="authSection" class="auth-container">
                <div class="auth-header">
                    <h1 class="auth-title">Welcome to Chesscom Helper</h1>
                    <p class="auth-subtitle">Track your favorite Chess.com players</p>
                </div>
                
                <div class="auth-tabs">
                    <button class="auth-tab active" onclick="switchTab('login')">Login</button>
                    <button class="auth-tab" onclick="switchTab('register')">Register</button>
                </div>
                
                <!-- Login Form -->
                <form id="loginForm" class="auth-form">
                    <div id="loginError" class="error-message hidden"></div>
                    <div class="form-group">
                        <label class="form-label" for="loginEmail">Email Address</label>
                        <input type="email" id="loginEmail" class="form-input" placeholder="Enter your email" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="loginPassword">Password</label>
                        <input type="password" id="loginPassword" class="form-input" placeholder="Enter your password" required>
                    </div>
                    <button type="submit" class="form-button">Sign In</button>
                </form>
                
                <!-- Register Form -->
                <form id="registerForm" class="auth-form hidden">
                    <div id="registerError" class="error-message hidden"></div>
                    <div class="form-group">
                        <label class="form-label" for="registerEmail">Email Address</label>
                        <input type="email" id="registerEmail" class="form-input" placeholder="Enter your email" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="registerPassword">Password</label>
                        <input type="password" id="registerPassword" class="form-input" placeholder="Create a password" required>
                    </div>
                    <button type="submit" class="form-button">Create Account</button>
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
                                            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()">
                                        </th>
                                        <th class="sortable" data-sort="player">Player</th>
                                        <th class="sortable" data-sort="lastSeen">Last Seen on Chess.com</th>
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
            </section>
        </div>
    </main>
    
    <!-- GitHub Icon -->
    <a href="https://github.com/emily-flambe/chesscom-helper" class="github-icon" target="_blank" rel="noopener noreferrer" title="View on GitHub">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
    </a>
    
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
            
            tabs.forEach(t => t.classList.remove('active'));
            
            if (tab === 'login') {
                tabs[0].classList.add('active');
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                tabs[1].classList.add('active');
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
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
        
        // Initialize on page load
        initAuth();
        
        // Check welcome card visibility after DOM is ready
        setTimeout(checkWelcomeCardVisibility, 100);
    </script>
</body>
</html>`
}