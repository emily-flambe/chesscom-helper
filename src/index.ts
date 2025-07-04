export interface Env {
  DB: D1Database
  JWT_SECRET: string
  ENVIRONMENT?: string
}

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

// Generate secure ID
function generateId(): string {
  return crypto.randomUUID()
}

// In-memory storage for monitored players (will be moved to D1 later)
const monitoredPlayers: string[] = []

// Chess.com validation
async function validateChessComUser(username: string): Promise<{ exists: boolean, data?: any }> {
  try {
    const normalizedUsername = username.toLowerCase()
    const response = await fetch(`https://api.chess.com/pub/player/${normalizedUsername}`, {
      headers: { 'User-Agent': 'Chess.com-Helper/1.0' }
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
        message: 'Chess.com Helper running with D1'
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

    // Get players API
    if (url.pathname === '/api/players' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        players: monitoredPlayers,
        count: monitoredPlayers.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Monitor player API
    if (url.pathname === '/api/monitor' && request.method === 'POST') {
      try {
        const body = await request.json() as { username: string }
        
        if (!body.username || body.username.length < 3) {
          return new Response(JSON.stringify({ error: 'Invalid username' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        if (monitoredPlayers.includes(body.username)) {
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
        
        monitoredPlayers.push(body.username)
        
        return new Response(JSON.stringify({ 
          success: true,
          message: `Started monitoring ${body.username}`,
          username: body.username
        }), { headers: { 'Content-Type': 'application/json' } })
        
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), 
          { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
    }
    
    // Favicon
    if (url.pathname === '/favicon.png') {
      try {
        const faviconFile = await fetch('https://raw.githubusercontent.com/emily-flambe/chesscom-helper/feature/development/majestic-knight.png')
        if (faviconFile.ok) {
          return new Response(faviconFile.body, {
            headers: { 
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=86400'
            }
          })
        }
      } catch (error) {
        console.error('Error fetching favicon:', error)
      }
      return new Response('Not Found', { status: 404 })
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
    <title>Chess.com Helper</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
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
        font-size: 1.5rem;
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
        max-width: 800px;
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
      }
      
      .welcome-text {
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      
      .welcome-user {
        color: var(--primary-green);
        font-weight: 600;
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
      
      /* Player Cards */
      .players-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--spacing-md);
      }
      
      .player-card {
        background: var(--bg-green-gray);
        padding: var(--spacing-lg);
        border-radius: var(--radius-md);
        border: 1px solid var(--border-green);
        transition: all 0.2s ease;
      }
      
      .player-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      
      .player-info {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }
      
      .player-avatar {
        width: 40px;
        height: 40px;
        background: var(--primary-green);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: white;
      }
      
      .player-details {
        flex: 1;
      }
      
      .player-name {
        color: var(--text-primary);
        font-weight: 600;
        font-size: 1rem;
        margin: 0;
      }
      
      .player-status {
        color: var(--success-green);
        font-size: 0.85rem;
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        background: var(--success-green);
        border-radius: 50%;
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
        
        .players-grid {
          grid-template-columns: 1fr;
        }
        
        .welcome-card {
          flex-direction: column;
          text-align: center;
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
    </style>
</head>
<body>
    <!-- Header Navigation -->
    <header class="header">
        <div class="header-content">
            <a href="/" class="logo">
                <span class="logo-icon">♚</span>
                <span>Chess Helper</span>
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
                    <h1 class="auth-title">Welcome to Chess Helper</h1>
                    <p class="auth-subtitle">Track your favorite Chess.com players</p>
                </div>
                
                <div class="auth-tabs">
                    <button class="auth-tab active" onclick="switchTab('login')">Login</button>
                    <button class="auth-tab" onclick="switchTab('register')">Register</button>
                </div>
                
                <!-- Login Form -->
                <form id="loginForm" class="auth-form">
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
                <div class="welcome-card">
                    <div>
                        <div class="welcome-text">
                            Welcome back, <span class="welcome-user" id="currentUser">User</span>!
                        </div>
                    </div>
                    <div class="status-indicator"></div>
                </div>
                
                <div class="tracking-section">
                    <div class="section-header">
                        <span class="section-icon">👥</span>
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
                    
                    <div id="playersContainer">
                        <div class="players-grid" id="playersList">
                            <!-- Players will be loaded here -->
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
        
        // Show toast notifications (placeholder for now)
        function showNotification(message, type = 'info') {
            // For now, still using alert - can be enhanced with toast UI later
            const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
            alert(emoji + ' ' + message);
        }
        
        // Auth form handlers
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const button = this.querySelector('button');
            
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
        
        async function loadPlayers() {
            const list = document.getElementById('playersList');
            list.innerHTML = '<div class="loading">Loading players...</div>';
            
            try {
                const response = await fetch('/api/players');
                const data = await response.json();
                
                if (data.players.length === 0) {
                    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">♟️</div><div class="empty-state-text">No players monitored yet</div><div class="empty-state-subtext">Add a Chess.com username above to start tracking</div></div>';
                } else {
                    list.innerHTML = data.players.map(player => 
                        '<div class="player-card"><div class="player-info"><div class="player-avatar">♟️</div><div class="player-details"><div class="player-name">' + player + '</div><div class="player-status"><span class="status-indicator"></span>Monitoring active</div></div></div></div>'
                    ).join('');
                }
            } catch (error) {
                list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">Error loading players</div><div class="empty-state-subtext">Please try refreshing the page</div></div>';
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
                    headers: { 'Content-Type': 'application/json' },
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
        
        // Initialize on page load
        initAuth();
    </script>
</body>
</html>`
}