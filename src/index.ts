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
let monitoredPlayers: string[] = []

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
<html>
<head>
    <title>Chess.com Helper</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <style>
      body { font-family: system-ui; margin: 0; background: #0f0f23; color: #e8eaed; padding: 2rem; }
      .container { max-width: 600px; margin: 0 auto; background: #16213e; padding: 2rem; border-radius: 20px; }
      h1 { text-align: center; color: #64b5f6; }
      .form-group { margin: 1rem 0; }
      label { display: block; margin-bottom: 0.5rem; color: #9aa0a6; }
      input { width: 100%; padding: 0.8rem; background: #1a1a2e; border: 1px solid #333; border-radius: 8px; color: #e8eaed; }
      button { width: 100%; padding: 0.8rem; background: #64b5f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 0.5rem; }
      button:hover { background: #90caf9; }
      button.secondary { background: #666; }
      button.secondary:hover { background: #777; }
      .players { margin-top: 2rem; }
      .player { background: #1a1a2e; padding: 0.8rem; margin: 0.5rem 0; border-radius: 8px; }
      .hidden { display: none; }
      .auth-section { margin-bottom: 2rem; }
      .user-info { background: #1a1a2e; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
      .tabs { display: flex; margin-bottom: 1rem; }
      .tab { flex: 1; padding: 0.5rem; text-align: center; background: #1a1a2e; cursor: pointer; }
      .tab.active { background: #64b5f6; }
      .tab:first-child { border-radius: 8px 0 0 8px; }
      .tab:last-child { border-radius: 0 8px 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>♚ Chess.com Helper (D1 Auth)</h1>
        
        <!-- Auth Section -->
        <div id="authSection" class="auth-section">
            <div class="tabs">
                <div class="tab active" onclick="switchTab('login')">Login</div>
                <div class="tab" onclick="switchTab('register')">Register</div>
            </div>
            
            <!-- Login Form -->
            <form id="loginForm">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="loginEmail" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit">Login</button>
            </form>
            
            <!-- Register Form -->
            <form id="registerForm" class="hidden">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="registerEmail" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="registerPassword" required>
                </div>
                <button type="submit">Register</button>
            </form>
        </div>
        
        <!-- Main App (hidden until authenticated) -->
        <div id="mainApp" class="hidden">
            <div class="user-info">
                <span>Welcome, <strong id="currentUser"></strong>!</span>
                <button class="secondary" onclick="logout()" style="float: right; width: auto; padding: 0.4rem 1rem;">Logout</button>
                <div style="clear: both;"></div>
            </div>
            
            <form id="playerForm">
                <div class="form-group">
                    <label>Chess.com Username</label>
                    <input type="text" id="username" placeholder="e.g. MagnusCarlsen" required>
                </div>
                <button type="submit">Start Monitoring</button>
            </form>
            
            <div class="players">
                <h3>Monitored Players</h3>
                <div id="playersList">Loading...</div>
            </div>
        </div>
    </div>
    
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
        }
        
        function showMainApp() {
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('currentUser').textContent = currentUser || 'User';
            loadPlayers();
        }
        
        function switchTab(tab) {
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(t => t.classList.remove('active'));
            
            if (tab === 'login') {
                tabs[0].classList.add('active');
                document.getElementById('loginForm').classList.remove('hidden');
                document.getElementById('registerForm').classList.add('hidden');
            } else {
                tabs[1].classList.add('active');
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('registerForm').classList.remove('hidden');
            }
        }
        
        function logout() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            currentToken = null;
            currentUser = null;
            showAuthSection();
        }
        
        // Auth form handlers
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
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
                    alert('❌ ' + data.error);
                }
            } catch (error) {
                alert('❌ Login failed');
            }
        });
        
        document.getElementById('registerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            
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
                    alert('❌ ' + data.error);
                }
            } catch (error) {
                alert('❌ Registration failed');
            }
        });
        
        async function loadPlayers() {
            try {
                const response = await fetch('/api/players');
                const data = await response.json();
                const list = document.getElementById('playersList');
                if (data.players.length === 0) {
                    list.innerHTML = '<p>No players yet</p>';
                } else {
                    list.innerHTML = data.players.map(p => 
                        '<div class="player">♟️ ' + p + '</div>'
                    ).join('');
                }
            } catch (error) {
                document.getElementById('playersList').innerHTML = '<p>Error loading</p>';
            }
        }
        
        document.getElementById('playerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const btn = this.querySelector('button');
            
            if (!username) return;
            
            btn.disabled = true;
            btn.textContent = 'Checking...';
            
            try {
                const response = await fetch('/api/monitor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('✅ ' + data.message);
                    document.getElementById('username').value = '';
                    loadPlayers();
                } else {
                    alert('❌ ' + data.error);
                }
            } catch (error) {
                alert('❌ Error connecting to server');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Start Monitoring';
            }
        });
        
        // Initialize on page load
        initAuth();
    </script>
</body>
</html>`
}