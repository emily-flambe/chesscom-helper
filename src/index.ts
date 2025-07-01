export interface Env {
  DB: D1Database
  CACHE: KVNamespace
  JWT_SECRET: string
  CHESS_COM_API_URL: string
  EMAIL_API_KEY: string
  RESEND_API_KEY: string
}

// In-memory storage for monitored players
let monitoredPlayers: string[] = []

// Validate Chess.com user
async function validateChessComUser(username: string): Promise<{ exists: boolean, data?: any }> {
  try {
    // Chess.com usernames are case-insensitive in the API
    const normalizedUsername = username.toLowerCase()
    const response = await fetch(`https://api.chess.com/pub/player/${normalizedUsername}`, {
      headers: {
        'User-Agent': 'Chess.com-Helper/1.0'
      }
    })
    
    console.log(`Chess.com API response for ${normalizedUsername}: ${response.status}`)
    
    if (response.status === 200) {
      const data = await response.json()
      return { exists: true, data }
    } else if (response.status === 404) {
      return { exists: false }
    }
    
    // For any other status, allow the user to be added
    return { exists: true }
  } catch (error) {
    console.error('Chess.com API error:', error)
    return { exists: true } // Allow if API fails
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
    
    // Get players API
    if (url.pathname === '/api/players' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        players: monitoredPlayers,
        count: monitoredPlayers.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Test Chess.com API endpoint
    if (url.pathname.startsWith('/api/test-chess/')) {
      const username = url.pathname.replace('/api/test-chess/', '')
      try {
        const response = await fetch(`https://api.chess.com/pub/player/${username}`, {
          headers: {
            'User-Agent': 'Chess.com-Helper/1.0'
          }
        })
        
        const responseText = await response.text()
        let data = null
        try {
          data = JSON.parse(responseText)
        } catch (e) {
          // Not JSON
        }
        
        return new Response(JSON.stringify({ 
          username,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          data: data,
          responseText: responseText.substring(0, 500)
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error.toString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // Monitor player API
    if (url.pathname === '/api/monitor' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { username } = body
        
        if (!username || username.length < 3) {
          return new Response(JSON.stringify({ 
            error: 'Invalid username' 
          }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        
        if (monitoredPlayers.includes(username)) {
          return new Response(JSON.stringify({ 
            error: `Already monitoring ${username}` 
          }), { status: 400, headers: { 'Content-Type': 'application/json' } })
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
        return new Response(JSON.stringify({ 
          error: 'Invalid request' 
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
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
    <style>
      body { font-family: system-ui; margin: 0; background: #0f0f23; color: #e8eaed; padding: 2rem; }
      .container { max-width: 600px; margin: 0 auto; background: #16213e; padding: 2rem; border-radius: 20px; }
      h1 { text-align: center; color: #64b5f6; }
      .form-group { margin: 1rem 0; }
      label { display: block; margin-bottom: 0.5rem; color: #9aa0a6; }
      input { width: 100%; padding: 0.8rem; background: #1a1a2e; border: 1px solid #333; border-radius: 8px; color: #e8eaed; }
      button { width: 100%; padding: 0.8rem; background: #64b5f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
      button:hover { background: #90caf9; }
      .players { margin-top: 2rem; }
      .player { background: #1a1a2e; padding: 0.8rem; margin: 0.5rem 0; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>♚ Chess.com Helper</h1>
        
        <form id="playerForm">
            <div class="form-group">
                <label>Chess.com Username</label>
                <input type="text" id="username" placeholder="e.g. Magnus" required>
            </div>
            <button type="submit">Start Monitoring</button>
        </form>
        
        <div class="players">
            <h3>Monitored Players</h3>
            <div id="playersList">Loading...</div>
        </div>
    </div>
    
    <script>
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
        
        loadPlayers();
    </script>
</body>
</html>`
}