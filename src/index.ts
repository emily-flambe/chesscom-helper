export interface Env {
  DB: D1Database
  CACHE: KVNamespace
  JWT_SECRET: string
  CHESS_COM_API_URL: string
  EMAIL_API_KEY: string
  RESEND_API_KEY: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    
    // Basic health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Chesscom Helper API is running'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Serve favicon
    if (url.pathname === '/favicon.ico') {
      try {
        // For Cloudflare Workers, we need to embed the favicon or serve it differently
        // Since we can't access the filesystem directly, return a 404 for now
        // The favicon will be referenced in HTML but served from the project root
        return new Response('Not Found', { status: 404 })
      } catch (error) {
        return new Response('Not Found', { status: 404 })
      }
    }
    
    // Root path - serve HTML frontend
    if (url.pathname === '/') {
      return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Chesscom Helper</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      :root {
        --bg-primary: #0f0f23;
        --bg-secondary: #1a1a2e;
        --bg-card: #16213e;
        --chess-dark: #2d1810;
        --chess-light: #4a3426;
        --accent: #64b5f6;
        --accent-bright: #90caf9;
        --success: #4caf50;
        --text-primary: #e8eaed;
        --text-secondary: #9aa0a6;
        --shadow: rgba(0,0,0,0.4);
        --glow: rgba(100, 181, 246, 0.2);
      }
      
      * { box-sizing: border-box; }
      
      body {
        font-family: 'Segoe UI', system-ui, sans-serif;
        margin: 0;
        background: linear-gradient(135deg, var(--bg-primary), var(--bg-secondary));
        min-height: 100vh;
        padding: 2rem;
        color: var(--text-primary);
      }
      
      .chess-board {
        max-width: 600px;
        margin: 0 auto;
        background: var(--bg-card);
        border-radius: 20px;
        box-shadow: 0 10px 30px var(--shadow), 0 0 0 1px rgba(255,255,255,0.1);
        padding: 2rem;
        position: relative;
        overflow: hidden;
      }
      
      .chess-board::before {
        content: '';
        position: absolute;
        top: -10px;
        right: -10px;
        width: 60px;
        height: 60px;
        background: repeating-conic-gradient(var(--chess-light) 0deg 90deg, var(--chess-dark) 90deg 180deg);
        border-radius: 8px;
        opacity: 0.6;
      }
      
      h1 {
        color: var(--text-primary);
        text-align: center;
        margin: 0 0 1rem 0;
        font-size: 2.5rem;
        font-weight: 700;
        text-shadow: 0 0 20px var(--glow);
      }
      
      h1::after {
        content: ' ♚';
        color: var(--accent-bright);
        filter: drop-shadow(0 0 10px var(--accent));
      }
      
      .subtitle {
        text-align: center;
        color: var(--text-secondary);
        margin-bottom: 2rem;
        font-size: 1.1rem;
      }
      
      .status-card {
        background: linear-gradient(135deg, var(--success), #66bb6a);
        color: white;
        padding: 1.5rem;
        border-radius: 15px;
        text-align: center;
        margin: 1.5rem 0;
        box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3), inset 0 1px 0 rgba(255,255,255,0.2);
      }
      
      .status-card h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.3rem;
      }
      
      .btn {
        display: inline-block;
        background: linear-gradient(135deg, var(--accent), var(--accent-bright));
        color: white;
        padding: 0.8rem 2rem;
        border-radius: 25px;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(100, 181, 246, 0.3);
        border: 1px solid rgba(255,255,255,0.2);
      }
      
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(100, 181, 246, 0.4);
        filter: brightness(1.1);
      }
      
      .coming-soon {
        text-align: center;
        margin-top: 2rem;
        padding: 1rem;
        background: var(--bg-secondary);
        border-radius: 10px;
        border-left: 4px solid var(--accent);
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .coming-soon h3 {
        color: var(--text-primary);
        margin-top: 0;
      }
      
      .coming-soon p {
        color: var(--text-secondary);
      }
      
      .monitor-form {
        margin: 2rem 0;
        padding: 1.5rem;
        background: var(--bg-secondary);
        border-radius: 15px;
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .monitor-form h3 {
        color: var(--text-primary);
        margin: 0 0 1rem 0;
        text-align: center;
      }
      
      .input-group {
        margin-bottom: 1rem;
      }
      
      .input-group label {
        display: block;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
      }
      
      .input-group input {
        width: 100%;
        padding: 0.8rem 1rem;
        background: var(--bg-card);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        color: var(--text-primary);
        font-size: 1rem;
        transition: all 0.3s ease;
      }
      
      .input-group input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px var(--glow);
      }
      
      .input-group input::placeholder {
        color: var(--text-secondary);
        opacity: 0.7;
      }
      
      .btn-primary {
        width: 100%;
        background: linear-gradient(135deg, var(--accent), var(--accent-bright));
        color: white;
        padding: 0.8rem 2rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(100, 181, 246, 0.3);
      }
      
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(100, 181, 246, 0.4);
        filter: brightness(1.1);
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      
      .floating {
        animation: float 3s ease-in-out infinite;
      }
    </style>
</head>
<body>
    <div class="chess-board">
        <h1 class="floating">Chesscom Helper</h1>
        <p class="subtitle">Monitor your favorite Chess.com players and get email notifications!</p>
        
        <div class="status-card">
            <h2>✅ API Status</h2>
            <p>Server is running smoothly</p>
            <a href="/health" class="btn">Check Health</a>
        </div>
        
        <div class="monitor-form">
            <h3>🎯 Monitor a Player</h3>
            <form id="playerForm">
                <div class="input-group">
                    <label for="username">Chess.com Username</label>
                    <input type="text" id="username" name="username" placeholder="e.g. Magnus" required>
                </div>
                <button type="submit" class="btn-primary">Start Monitoring</button>
            </form>
        </div>
        
        <div class="coming-soon">
            <h3>🚀 Coming Soon</h3>
            <p>Email notifications, game analysis, and more!</p>
        </div>
    </div>
    
    <script>
        document.getElementById('playerForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const submitBtn = this.querySelector('button[type="submit"]');
            
            if (!username) {
                alert('Please enter a username');
                return;
            }
            
            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
            
            try {
                const response = await fetch('/api/monitor', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('✅ ' + data.message);
                    document.getElementById('username').value = '';
                } else {
                    alert('❌ ' + data.error);
                }
            } catch (error) {
                alert('❌ Error connecting to server');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Start Monitoring';
            }
        });
    </script>
</body>
</html>`, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // API endpoint to monitor a player
    if (url.pathname === '/api/monitor' && request.method === 'POST') {
      try {
        const body = await request.json()
        const { username } = body
        
        if (!username || username.length < 3 || username.length > 25) {
          return new Response(JSON.stringify({ 
            error: 'Invalid username. Must be between 3 and 25 characters.' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        // For now, just acknowledge the request
        return new Response(JSON.stringify({ 
          success: true,
          message: `Started monitoring ${username}`,
          username: username
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    // 404 for everything else
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}