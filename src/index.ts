// Minimal interface for now
export interface Env {}

// In-memory storage for monitored players
let monitoredPlayers: string[] = []

// Simple in-memory auth
let users: Map<string, {id: string, username: string, password: string}> = new Map()
let sessions: Map<string, {userId: string, token: string}> = new Map()

function generateToken(): string {
  return Math.random().toString(36) + Date.now().toString(36)
}

// Chess.com validation (keep this working)
async function validateChessComUser(username: string): Promise<{ exists: boolean, data?: any }> {
  try {
    const normalizedUsername = username.toLowerCase()
    const response = await fetch(`https://api.chess.com/pub/player/${normalizedUsername}`, {
      headers: {
        'User-Agent': 'Chess.com-Helper/1.0'
      }
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
        message: 'Chess.com Helper running'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Auth register
    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { username, password } = body
        
        if (!username || !password) {
          return new Response(JSON.stringify({ error: 'Username and password required' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        if (users.has(username)) {
          return new Response(JSON.stringify({ error: 'User already exists' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        const userId = generateToken()
        users.set(username, { id: userId, username, password })
        
        const token = generateToken()
        sessions.set(token, { userId, token })
        
        return new Response(JSON.stringify({ 
          success: true, 
          token, 
          user: { id: userId, username }
        }), { headers: { 'Content-Type': 'application/json' } })
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Registration failed' }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Auth login
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { username, password } = body
        
        const user = users.get(username)
        if (!user || user.password !== password) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), 
            { status: 401, headers: { 'Content-Type': 'application/json' } })
        }
        
        const token = generateToken()
        sessions.set(token, { userId: user.id, token })
        
        return new Response(JSON.stringify({ 
          success: true, 
          token, 
          user: { id: user.id, username: user.username }
        }), { headers: { 'Content-Type': 'application/json' } })
      } catch (error) {
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

    // Monitor player API (with Chess.com validation)
    if (url.pathname === '/api/monitor' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { username } = body
        
        if (!username || username.length < 3) {
          return new Response(JSON.stringify({ error: 'Invalid username' }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        if (monitoredPlayers.includes(username)) {
          return new Response(JSON.stringify({ error: `Already monitoring ${username}` }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        // Validate user exists on Chess.com
        const validation = await validateChessComUser(username)
        if (!validation.exists) {
          return new Response(JSON.stringify({ 
            error: `User "${username}" not found on Chess.com. Try the exact username (e.g., "MagnusCarlsen" instead of "Magnus")` 
          }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        }
        
        monitoredPlayers.push(username)
        
        return new Response(JSON.stringify({ 
          success: true,
          message: `Started monitoring ${username}`,
          username: username
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
        <h1>♚ Chess.com Helper</h1>
        
        <!-- Auth Section -->
        <div id="authSection" class="auth-section">
            <div class="tabs">
                <div class="tab active" onclick="switchTab('login')">Login</div>
                <div class="tab" onclick="switchTab('register')">Register</div>
            </div>
            
            <!-- Login Form -->
            <form id="loginForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="loginUsername" required>
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
                    <label>Username</label>
                    <input type="text" id="registerUsername" required>
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
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    currentToken = data.token;
                    currentUser = data.user.username;
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
            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    currentToken = data.token;
                    currentUser = data.user.username;
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