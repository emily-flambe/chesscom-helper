var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-dF49rh/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-dF49rh/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.ts
var monitoredPlayers = [];
async function validateChessComUser(username) {
  try {
    const response = await fetch(`https://api.chess.com/pub/player/${username}`, {
      headers: {
        "User-Agent": "ChesscomHelper/1.0"
      }
    });
    if (response.status === 200) {
      const data = await response.json();
      return { exists: true, data };
    } else if (response.status === 404) {
      return { exists: false };
    } else {
      throw new Error(`Chess.com API returned ${response.status}`);
    }
  } catch (error) {
    console.error("Chess.com API error:", error);
    return { exists: true };
  }
}
__name(validateChessComUser, "validateChessComUser");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        message: "Chesscom Helper API is running"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/favicon.ico") {
      try {
        return new Response("Not Found", { status: 404 });
      } catch (error) {
        return new Response("Not Found", { status: 404 });
      }
    }
    if (url.pathname === "/") {
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
        content: ' \u265A';
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
      
      .players-list {
        margin: 2rem 0;
        padding: 1.5rem;
        background: var(--bg-secondary);
        border-radius: 15px;
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .players-list h3 {
        color: var(--text-primary);
        margin: 0 0 1rem 0;
        text-align: center;
      }
      
      .no-players {
        color: var(--text-secondary);
        text-align: center;
        font-style: italic;
        margin: 0;
      }
      
      .player-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--bg-card);
        padding: 0.8rem 1rem;
        margin: 0.5rem 0;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .player-name {
        color: var(--text-primary);
        font-weight: 500;
      }
      
      .player-status {
        color: var(--success);
        font-size: 0.9rem;
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
            <h2>\u2705 API Status</h2>
            <p>Server is running smoothly</p>
            <a href="/health" class="btn">Check Health</a>
        </div>
        
        <div class="monitor-form">
            <h3>\u{1F3AF} Monitor a Player</h3>
            <form id="playerForm">
                <div class="input-group">
                    <label for="username">Chess.com Username</label>
                    <input type="text" id="username" name="username" placeholder="e.g. Magnus" required>
                </div>
                <button type="submit" class="btn-primary">Start Monitoring</button>
            </form>
        </div>
        
        <div class="players-list">
            <h3>\u{1F465} Monitored Players</h3>
            <div id="playersList">
                <p class="no-players">No players being monitored yet. Add one above!</p>
            </div>
        </div>
        
        <div class="coming-soon">
            <h3>\u{1F680} Coming Soon</h3>
            <p>Email notifications, game analysis, and more!</p>
        </div>
    </div>
    
    <script>
        // Load players list on page load
        async function loadPlayers() {
            try {
                const response = await fetch('/api/players');
                const data = await response.json();
                displayPlayers(data.players);
            } catch (error) {
                console.error('Failed to load players:', error);
            }
        }
        
        // Display players in the list
        function displayPlayers(players) {
            const playersList = document.getElementById('playersList');
            
            if (players.length === 0) {
                playersList.innerHTML = '<p class="no-players">No players being monitored yet. Add one above!</p>';
                return;
            }
            
            playersList.innerHTML = players.map(player => 
                '<div class="player-item">' +
                    '<span class="player-name">\u265F\uFE0F ' + player + '</span>' +
                    '<span class="player-status">Monitoring</span>' +
                '</div>'
            ).join('');
        }
        
        // Form submission
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
            submitBtn.textContent = 'Validating...';
            
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
                    let message = '\u2705 ' + data.message;
                    if (data.playerData && data.playerData.name) {
                        message += '
\u{1F464} Player: ' + data.playerData.name;
                    }
                    alert(message);
                    document.getElementById('username').value = '';
                    // Refresh the players list
                    loadPlayers();
                } else {
                    alert('\u274C ' + data.error);
                }
            } catch (error) {
                alert('\u274C Error connecting to server');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Start Monitoring';
            }
        });
        
        // Load players when page loads
        loadPlayers();
    <\/script>
</body>
</html>`, {
        headers: { "Content-Type": "text/html" }
      });
    }
    if (url.pathname === "/api/players" && request.method === "GET") {
      return new Response(JSON.stringify({
        players: monitoredPlayers,
        count: monitoredPlayers.length
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/monitor" && request.method === "POST") {
      try {
        const body = await request.json();
        const { username } = body;
        if (!username || username.length < 3 || username.length > 25) {
          return new Response(JSON.stringify({
            error: "Invalid username. Must be between 3 and 25 characters."
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (monitoredPlayers.includes(username)) {
          return new Response(JSON.stringify({
            error: `Already monitoring ${username}`
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const validation = await validateChessComUser(username);
        if (!validation.exists) {
          return new Response(JSON.stringify({
            error: `Chess.com user "${username}" not found. Please check the spelling.`
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }
        monitoredPlayers.push(username);
        return new Response(JSON.stringify({
          success: true,
          message: `Started monitoring ${username}`,
          username,
          totalPlayers: monitoredPlayers.length,
          playerData: validation.data ? {
            name: validation.data.name,
            joined: validation.data.joined,
            status: validation.data.status
          } : null
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Invalid request body"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-dF49rh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-dF49rh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
