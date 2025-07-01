var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-320UGL/checked-fetch.js
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

// .wrangler/tmp/bundle-320UGL/strip-cf-connecting-ip-header.js
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
    const normalizedUsername = username.toLowerCase();
    const response = await fetch(`https://api.chess.com/pub/player/${normalizedUsername}`, {
      headers: {
        "User-Agent": "Chess.com-Helper/1.0"
      }
    });
    console.log(`Chess.com API response for ${normalizedUsername}: ${response.status}`);
    if (response.status === 200) {
      const data = await response.json();
      return { exists: true, data };
    } else if (response.status === 404) {
      return { exists: false };
    }
    return { exists: true };
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
        message: "Chess.com Helper running"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/test" && request.method === "POST") {
      const body = await request.json();
      return new Response(JSON.stringify({ received: body }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/players" && request.method === "GET") {
      return new Response(JSON.stringify({
        players: monitoredPlayers,
        count: monitoredPlayers.length
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.pathname.startsWith("/api/test-chess/")) {
      const username = url.pathname.replace("/api/test-chess/", "");
      try {
        const response = await fetch(`https://api.chess.com/pub/player/${username}`, {
          headers: {
            "User-Agent": "Chess.com-Helper/1.0"
          }
        });
        const responseText = await response.text();
        let data = null;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
        }
        return new Response(JSON.stringify({
          username,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          data,
          responseText: responseText.substring(0, 500)
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.toString()
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/api/monitor" && request.method === "POST") {
      try {
        const body = await request.json();
        const { username } = body;
        if (!username || username.length < 3) {
          return new Response(JSON.stringify({
            error: "Invalid username"
          }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (monitoredPlayers.includes(username)) {
          return new Response(JSON.stringify({
            error: `Already monitoring ${username}`
          }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const validation = await validateChessComUser(username);
        if (!validation.exists) {
          return new Response(JSON.stringify({
            error: `User "${username}" not found on Chess.com. Try the exact username (e.g., "MagnusCarlsen" instead of "Magnus")`
          }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
        monitoredPlayers.push(username);
        return new Response(JSON.stringify({
          success: true,
          message: `Started monitoring ${username}`,
          username
        }), { headers: { "Content-Type": "application/json" } });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Invalid request"
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/") {
      return new Response(getHTML(), {
        headers: { "Content-Type": "text/html" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
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
        <h1>\u265A Chess.com Helper</h1>
        
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
                        '<div class="player">\u265F\uFE0F ' + p + '</div>'
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
                    alert('\u2705 ' + data.message);
                    document.getElementById('username').value = '';
                    loadPlayers();
                } else {
                    alert('\u274C ' + data.error);
                }
            } catch (error) {
                alert('\u274C Error connecting to server');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Start Monitoring';
            }
        });
        
        loadPlayers();
    <\/script>
</body>
</html>`;
}
__name(getHTML, "getHTML");

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

// .wrangler/tmp/bundle-320UGL/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-320UGL/middleware-loader.entry.ts
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
