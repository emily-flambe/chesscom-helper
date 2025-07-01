var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-SphtKo/checked-fetch.js
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
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-SphtKo/checked-fetch.js"() {
    "use strict";
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// .wrangler/tmp/bundle-SphtKo/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
var init_strip_cf_connecting_ip_header = __esm({
  ".wrangler/tmp/bundle-SphtKo/strip-cf-connecting-ip-header.js"() {
    "use strict";
    __name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        return Reflect.apply(target, thisArg, [
          stripCfConnectingIPHeader.apply(null, argArray)
        ]);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// node_modules/itty-router/index.mjs
var t, r, o, a, s, p, f, u, h, g, y;
var init_itty_router = __esm({
  "node_modules/itty-router/index.mjs"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    t = /* @__PURE__ */ __name(({ base: e = "", routes: t2 = [], ...r2 } = {}) => ({ __proto__: new Proxy({}, { get: (r3, o2, a2, s2) => (r4, ...c) => t2.push([o2.toUpperCase?.(), RegExp(`^${(s2 = (e + r4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), c, s2]) && a2 }), routes: t2, ...r2, async fetch(e2, ...o2) {
      let a2, s2, c = new URL(e2.url), n = e2.query = { __proto__: null };
      for (let [e3, t3] of c.searchParams)
        n[e3] = n[e3] ? [].concat(n[e3], t3) : t3;
      e:
        try {
          for (let t3 of r2.before || [])
            if (null != (a2 = await t3(e2.proxy ?? e2, ...o2)))
              break e;
          t:
            for (let [r3, n2, l, i] of t2)
              if ((r3 == e2.method || "ALL" == r3) && (s2 = c.pathname.match(n2))) {
                e2.params = s2.groups || {}, e2.route = i;
                for (let t3 of l)
                  if (null != (a2 = await t3(e2.proxy ?? e2, ...o2)))
                    break t;
              }
        } catch (t3) {
          if (!r2.catch)
            throw t3;
          a2 = await r2.catch(t3, e2.proxy ?? e2, ...o2);
        }
      try {
        for (let t3 of r2.finally || [])
          a2 = await t3(a2, e2.proxy ?? e2, ...o2) ?? a2;
      } catch (t3) {
        if (!r2.catch)
          throw t3;
        a2 = await r2.catch(t3, e2.proxy ?? e2, ...o2);
      }
      return a2;
    } }), "t");
    r = /* @__PURE__ */ __name((e = "text/plain; charset=utf-8", t2) => (r2, o2 = {}) => {
      if (void 0 === r2 || r2 instanceof Response)
        return r2;
      const a2 = new Response(t2?.(r2) ?? r2, o2.url ? void 0 : o2);
      return a2.headers.set("content-type", e), a2;
    }, "r");
    o = r("application/json; charset=utf-8", JSON.stringify);
    a = /* @__PURE__ */ __name((e) => ({ 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error" })[e] || "Unknown Error", "a");
    s = /* @__PURE__ */ __name((e = 500, t2) => {
      if (e instanceof Error) {
        const { message: r2, ...o2 } = e;
        e = e.status || 500, t2 = { error: r2 || a(e), ...o2 };
      }
      return t2 = { status: e, ..."object" == typeof t2 ? t2 : { error: t2 || a(e) } }, o(t2, { status: e });
    }, "s");
    p = r("text/plain; charset=utf-8", String);
    f = r("text/html");
    u = r("image/jpeg");
    h = r("image/png");
    g = r("image/webp");
    y = /* @__PURE__ */ __name((e = {}) => {
      const { origin: t2 = "*", credentials: r2 = false, allowMethods: o2 = "*", allowHeaders: a2, exposeHeaders: s2, maxAge: c } = e, n = /* @__PURE__ */ __name((e2) => {
        const o3 = e2?.headers.get("origin");
        return true === t2 ? o3 : t2 instanceof RegExp ? t2.test(o3) ? o3 : void 0 : Array.isArray(t2) ? t2.includes(o3) ? o3 : void 0 : t2 instanceof Function ? t2(o3) : "*" == t2 && r2 ? o3 : t2;
      }, "n"), l = /* @__PURE__ */ __name((e2, t3) => {
        for (const [r3, o3] of Object.entries(t3))
          o3 && e2.headers.append(r3, o3);
        return e2;
      }, "l");
      return { corsify: (e2, t3) => e2?.headers?.get("access-control-allow-origin") || 101 == e2.status ? e2 : l(e2.clone(), { "access-control-allow-origin": n(t3), "access-control-allow-credentials": r2 }), preflight: (e2) => {
        if ("OPTIONS" == e2.method) {
          const t3 = new Response(null, { status: 204 });
          return l(t3, { "access-control-allow-origin": n(e2), "access-control-allow-methods": o2?.join?.(",") ?? o2, "access-control-expose-headers": s2?.join?.(",") ?? s2, "access-control-allow-headers": a2?.join?.(",") ?? a2 ?? e2.headers.get("access-control-request-headers"), "access-control-max-age": c, "access-control-allow-credentials": r2 });
        }
      } };
    }, "y");
  }
});

// src/utils/crypto.ts
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(password, hash) {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}
async function generateSecureId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
var init_crypto = __esm({
  "src/utils/crypto.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    __name(hashPassword, "hashPassword");
    __name(verifyPassword, "verifyPassword");
    __name(generateSecureId, "generateSecureId");
  }
});

// src/middleware/errorHandler.ts
function errorHandler(error) {
  console.error("API Error:", {
    message: error.message,
    status: error.status,
    code: error.code,
    stack: error.stack,
    details: error.details
  });
  const status = error.status || 500;
  const code = error.code || "INTERNAL_SERVER_ERROR";
  let message = error.message || "An unexpected error occurred";
  if (status === 500) {
    message = "Internal server error";
  }
  const errorResponse = {
    error: {
      code,
      message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...false
    }
  };
  return o(errorResponse, {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Error-Code": code
    }
  });
}
function createApiError(message, status = 500, code, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}
var init_errorHandler = __esm({
  "src/middleware/errorHandler.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_itty_router();
    __name(errorHandler, "errorHandler");
    __name(createApiError, "createApiError");
  }
});

// src/services/userService.ts
async function createUser(db, userData) {
  const id = await generateSecureId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const result = await db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, userData.email, userData.passwordHash, now, now).run();
    if (!result.success) {
      throw createApiError("Failed to create user", 500, "USER_CREATION_FAILED");
    }
    return {
      id,
      email: userData.email,
      passwordHash: userData.passwordHash,
      createdAt: now,
      updatedAt: now
    };
  } catch (error) {
    console.error("Create user error:", error);
    throw createApiError("Failed to create user", 500, "USER_CREATION_FAILED", error);
  }
}
async function getUserById(db, userId) {
  try {
    const result = await db.prepare(`
      SELECT id, email, password_hash, created_at, updated_at
      FROM users 
      WHERE id = ?
    `).bind(userId).first();
    if (!result)
      return null;
    return {
      id: result.id,
      email: result.email,
      passwordHash: result.password_hash,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  } catch (error) {
    console.error("Get user by ID error:", error);
    throw createApiError("Failed to fetch user", 500, "USER_FETCH_FAILED", error);
  }
}
async function getUserByEmail(db, email) {
  try {
    const result = await db.prepare(`
      SELECT id, email, password_hash, created_at, updated_at
      FROM users 
      WHERE email = ?
    `).bind(email).first();
    if (!result)
      return null;
    return {
      id: result.id,
      email: result.email,
      passwordHash: result.password_hash,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  } catch (error) {
    console.error("Get user by email error:", error);
    throw createApiError("Failed to fetch user", 500, "USER_FETCH_FAILED", error);
  }
}
async function updateUser(db, userId, updateData) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updates = [];
  const values = [];
  if (updateData.email) {
    updates.push("email = ?");
    values.push(updateData.email);
  }
  if (updateData.passwordHash) {
    updates.push("password_hash = ?");
    values.push(updateData.passwordHash);
  }
  if (updates.length === 0) {
    throw createApiError("No valid fields to update", 400, "INVALID_UPDATE_DATA");
  }
  updates.push("updated_at = ?");
  values.push(now, userId);
  try {
    const result = await db.prepare(`
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = ?
    `).bind(...values).run();
    if (!result.success) {
      throw createApiError("Failed to update user", 500, "USER_UPDATE_FAILED");
    }
    const updatedUser = await getUserById(db, userId);
    if (!updatedUser) {
      throw createApiError("User not found after update", 404, "USER_NOT_FOUND");
    }
    return updatedUser;
  } catch (error) {
    console.error("Update user error:", error);
    throw createApiError("Failed to update user", 500, "USER_UPDATE_FAILED", error);
  }
}
async function deleteUser(db, userId) {
  try {
    const result = await db.prepare(`
      DELETE FROM users WHERE id = ?
    `).bind(userId).run();
    if (!result.success) {
      throw createApiError("Failed to delete user", 500, "USER_DELETE_FAILED");
    }
  } catch (error) {
    console.error("Delete user error:", error);
    throw createApiError("Failed to delete user", 500, "USER_DELETE_FAILED", error);
  }
}
var init_userService = __esm({
  "src/services/userService.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_crypto();
    init_errorHandler();
    __name(createUser, "createUser");
    __name(getUserById, "getUserById");
    __name(getUserByEmail, "getUserByEmail");
    __name(updateUser, "updateUser");
    __name(deleteUser, "deleteUser");
  }
});

// src/services/subscriptionService.ts
async function getPlayerSubscriptions(db, userId) {
  try {
    const result = await db.prepare(`
      SELECT id, user_id, chess_com_username, created_at
      FROM player_subscriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all();
    if (!result.results)
      return [];
    return result.results.map((row) => ({
      id: row.id,
      userId: row.user_id,
      chessComUsername: row.chess_com_username,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error("Get player subscriptions error:", error);
    throw createApiError("Failed to fetch subscriptions", 500, "SUBSCRIPTION_FETCH_FAILED", error);
  }
}
async function createPlayerSubscription(db, subscriptionData) {
  const id = await generateSecureId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const existingResult = await db.prepare(`
      SELECT id FROM player_subscriptions
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(subscriptionData.userId, subscriptionData.chessComUsername).first();
    if (existingResult) {
      throw createApiError("Already subscribed to this player", 409, "SUBSCRIPTION_EXISTS");
    }
    const result = await db.prepare(`
      INSERT INTO player_subscriptions (id, user_id, chess_com_username, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, subscriptionData.userId, subscriptionData.chessComUsername, now).run();
    if (!result.success) {
      throw createApiError("Failed to create subscription", 500, "SUBSCRIPTION_CREATION_FAILED");
    }
    await ensurePlayerInMonitoringSystem(db, subscriptionData.chessComUsername);
    return {
      id,
      userId: subscriptionData.userId,
      chessComUsername: subscriptionData.chessComUsername,
      createdAt: now
    };
  } catch (error) {
    console.error("Create subscription error:", error);
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      throw createApiError("Already subscribed to this player", 409, "SUBSCRIPTION_EXISTS");
    }
    throw createApiError("Failed to create subscription", 500, "SUBSCRIPTION_CREATION_FAILED", error);
  }
}
async function deletePlayerSubscription(db, userId, chessComUsername) {
  try {
    const result = await db.prepare(`
      DELETE FROM player_subscriptions
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(userId, chessComUsername).run();
    if (!result.success) {
      throw createApiError("Failed to delete subscription", 500, "SUBSCRIPTION_DELETE_FAILED");
    }
    await cleanupUnusedPlayerFromMonitoring(db, chessComUsername);
  } catch (error) {
    console.error("Delete subscription error:", error);
    throw createApiError("Failed to delete subscription", 500, "SUBSCRIPTION_DELETE_FAILED", error);
  }
}
async function getSubscribersForPlayer(db, chessComUsername) {
  try {
    const result = await db.prepare(`
      SELECT DISTINCT user_id
      FROM player_subscriptions
      WHERE chess_com_username = ?
    `).bind(chessComUsername).all();
    if (!result.results)
      return [];
    return result.results.map((row) => row.user_id);
  } catch (error) {
    console.error("Get subscribers for player error:", error);
    throw createApiError("Failed to fetch subscribers", 500, "SUBSCRIBERS_FETCH_FAILED", error);
  }
}
async function ensurePlayerInMonitoringSystem(db, chessComUsername) {
  try {
    const existingPlayer = await db.prepare(`
      SELECT chess_com_username FROM player_status
      WHERE chess_com_username = ?
    `).bind(chessComUsername).first();
    if (!existingPlayer) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(`
        INSERT INTO player_status (chess_com_username, is_online, is_playing, last_checked, updated_at)
        VALUES (?, false, false, ?, ?)
      `).bind(chessComUsername, now, now).run();
    }
  } catch (error) {
    console.error("Ensure player in monitoring system error:", error);
  }
}
async function cleanupUnusedPlayerFromMonitoring(db, chessComUsername) {
  try {
    const subscribers = await getSubscribersForPlayer(db, chessComUsername);
    if (subscribers.length === 0) {
      await db.prepare(`
        DELETE FROM player_status
        WHERE chess_com_username = ?
      `).bind(chessComUsername).run();
    }
  } catch (error) {
    console.error("Cleanup unused player error:", error);
  }
}
var init_subscriptionService = __esm({
  "src/services/subscriptionService.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_crypto();
    init_errorHandler();
    __name(getPlayerSubscriptions, "getPlayerSubscriptions");
    __name(createPlayerSubscription, "createPlayerSubscription");
    __name(deletePlayerSubscription, "deletePlayerSubscription");
    __name(getSubscribersForPlayer, "getSubscribersForPlayer");
    __name(ensurePlayerInMonitoringSystem, "ensurePlayerInMonitoringSystem");
    __name(cleanupUnusedPlayerFromMonitoring, "cleanupUnusedPlayerFromMonitoring");
  }
});

// src/services/chessComService.ts
async function verifyPlayerExists(username, baseUrl) {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL;
  try {
    const response = await fetchWithTimeout(`${apiUrl}/player/${username}`, {
      method: "GET",
      headers: {
        "User-Agent": "ChessComHelper/1.0"
      }
    }, REQUEST_TIMEOUT);
    return response.ok;
  } catch (error) {
    console.error("Verify player exists error:", error);
    return false;
  }
}
async function getPlayerInfo(username, baseUrl) {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL;
  try {
    const response = await fetchWithTimeout(`${apiUrl}/player/${username}`, {
      method: "GET",
      headers: {
        "User-Agent": "ChessComHelper/1.0"
      }
    }, REQUEST_TIMEOUT);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw createApiError(`Chess.com API error: ${response.status}`, 502, "CHESS_COM_API_ERROR");
    }
    const data = await response.json();
    return {
      username: data.username,
      playerId: data.player_id,
      title: data.title,
      name: data.name,
      country: data.country?.split("/").pop()?.replace(".png", ""),
      location: data.location,
      joined: data.joined,
      lastOnline: data.last_online,
      followers: data.followers,
      isStreamer: data.is_streamer,
      verified: data.verified
    };
  } catch (error) {
    console.error("Get player info error:", error);
    throw createApiError("Failed to fetch player information", 502, "CHESS_COM_API_ERROR", error);
  }
}
async function getPlayerCurrentGames(username, baseUrl) {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL;
  try {
    const response = await fetchWithTimeout(`${apiUrl}/player/${username}/games/current`, {
      method: "GET",
      headers: {
        "User-Agent": "ChessComHelper/1.0"
      }
    }, REQUEST_TIMEOUT);
    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw createApiError(`Chess.com API error: ${response.status}`, 502, "CHESS_COM_API_ERROR");
    }
    const data = await response.json();
    return data.games || [];
  } catch (error) {
    console.error("Get player current games error:", error);
    throw createApiError("Failed to fetch current games", 502, "CHESS_COM_API_ERROR", error);
  }
}
async function getPlayerGameStatus(username, baseUrl) {
  const apiUrl = baseUrl || CHESS_COM_BASE_URL;
  try {
    const [playerInfo, currentGames] = await Promise.all([
      getPlayerInfo(username, apiUrl),
      getPlayerCurrentGames(username, apiUrl)
    ]);
    const isOnline = playerInfo ? isPlayerOnline(playerInfo.lastOnline) : false;
    const isPlaying = currentGames.length > 0;
    return {
      username,
      isOnline,
      isPlaying,
      currentGames
    };
  } catch (error) {
    console.error("Get player game status error:", error);
    throw createApiError("Failed to fetch player game status", 502, "CHESS_COM_API_ERROR", error);
  }
}
async function batchGetPlayerStatuses(usernames, baseUrl) {
  const results = [];
  for (const username of usernames) {
    try {
      const status = await getPlayerGameStatus(username, baseUrl);
      results.push(status);
      if (usernames.length > 1) {
        await delay(RATE_LIMIT_DELAY);
      }
    } catch (error) {
      console.error(`Failed to get status for ${username}:`, error);
      results.push({
        username,
        isOnline: false,
        isPlaying: false,
        currentGames: []
      });
    }
  }
  return results;
}
function isPlayerOnline(lastOnline) {
  if (!lastOnline)
    return false;
  const fiveMinutesAgo = Date.now() / 1e3 - 300;
  return lastOnline > fiveMinutesAgo;
}
async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var CHESS_COM_BASE_URL, REQUEST_TIMEOUT, RATE_LIMIT_DELAY;
var init_chessComService = __esm({
  "src/services/chessComService.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_errorHandler();
    CHESS_COM_BASE_URL = "https://api.chess.com/pub";
    REQUEST_TIMEOUT = 1e4;
    RATE_LIMIT_DELAY = 200;
    __name(verifyPlayerExists, "verifyPlayerExists");
    __name(getPlayerInfo, "getPlayerInfo");
    __name(getPlayerCurrentGames, "getPlayerCurrentGames");
    __name(getPlayerGameStatus, "getPlayerGameStatus");
    __name(batchGetPlayerStatuses, "batchGetPlayerStatuses");
    __name(isPlayerOnline, "isPlayerOnline");
    __name(fetchWithTimeout, "fetchWithTimeout");
    __name(delay, "delay");
  }
});

// src/services/monitoringService.ts
async function getPlayerStatus(db, chessComUsername) {
  try {
    const result = await db.prepare(`
      SELECT chess_com_username, is_online, is_playing, current_game_url, 
             last_seen, last_checked, updated_at
      FROM player_status
      WHERE chess_com_username = ?
    `).bind(chessComUsername).first();
    if (!result)
      return null;
    return {
      chessComUsername: result.chess_com_username,
      isOnline: Boolean(result.is_online),
      isPlaying: Boolean(result.is_playing),
      currentGameUrl: result.current_game_url,
      lastSeen: result.last_seen,
      lastChecked: result.last_checked,
      updatedAt: result.updated_at
    };
  } catch (error) {
    console.error("Get player status error:", error);
    throw createApiError("Failed to fetch player status", 500, "PLAYER_STATUS_FETCH_FAILED", error);
  }
}
async function updatePlayerStatus(db, chessComUsername, status) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const result = await db.prepare(`
      INSERT INTO player_status (
        chess_com_username, is_online, is_playing, current_game_url, 
        last_seen, last_checked, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chess_com_username) DO UPDATE SET
        is_online = excluded.is_online,
        is_playing = excluded.is_playing,
        current_game_url = excluded.current_game_url,
        last_seen = COALESCE(excluded.last_seen, last_seen),
        last_checked = excluded.last_checked,
        updated_at = excluded.updated_at
    `).bind(
      chessComUsername,
      status.isOnline,
      status.isPlaying,
      status.currentGameUrl || null,
      status.lastSeen || null,
      now,
      now
    ).run();
    if (!result.success) {
      throw createApiError("Failed to update player status", 500, "PLAYER_STATUS_UPDATE_FAILED");
    }
  } catch (error) {
    console.error("Update player status error:", error);
    throw createApiError("Failed to update player status", 500, "PLAYER_STATUS_UPDATE_FAILED", error);
  }
}
async function getAllMonitoredPlayers(db) {
  try {
    const result = await db.prepare(`
      SELECT DISTINCT chess_com_username
      FROM player_subscriptions
      ORDER BY chess_com_username
    `).all();
    if (!result.results)
      return [];
    return result.results.map((row) => row.chess_com_username);
  } catch (error) {
    console.error("Get all monitored players error:", error);
    throw createApiError("Failed to fetch monitored players", 500, "MONITORED_PLAYERS_FETCH_FAILED", error);
  }
}
async function getMonitoringStatus(db) {
  try {
    const [totalPlayers, activeGames, recentJobs] = await Promise.all([
      getTotalMonitoredPlayers(db),
      getActiveGamesCount(db),
      getRecentMonitoringJobs(db)
    ]);
    const lastFullCheck = recentJobs.length > 0 ? recentJobs[0].completedAt : null;
    const checksLast24Hours = recentJobs.filter((job) => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      return new Date(job.completedAt || job.createdAt) > twentyFourHoursAgo;
    }).length;
    let systemStatus = "healthy";
    if (checksLast24Hours === 0) {
      systemStatus = "down";
    } else if (checksLast24Hours < 100) {
      systemStatus = "degraded";
    }
    return {
      totalPlayersMonitored: totalPlayers,
      activeGames,
      lastFullCheck,
      systemStatus,
      checksLast24Hours
    };
  } catch (error) {
    console.error("Get monitoring status error:", error);
    throw createApiError("Failed to fetch monitoring status", 500, "MONITORING_STATUS_FETCH_FAILED", error);
  }
}
async function getTotalMonitoredPlayers(db) {
  const result = await db.prepare(`
    SELECT COUNT(DISTINCT chess_com_username) as count
    FROM player_subscriptions
  `).first();
  return result?.count || 0;
}
async function getActiveGamesCount(db) {
  const result = await db.prepare(`
    SELECT COUNT(*) as count
    FROM player_status
    WHERE is_playing = true
  `).first();
  return result?.count || 0;
}
async function getRecentMonitoringJobs(db) {
  const result = await db.prepare(`
    SELECT id, job_type, status, created_at, completed_at
    FROM monitoring_jobs
    WHERE job_type IN ('player_check', 'batch_poll')
    ORDER BY created_at DESC
    LIMIT 10
  `).all();
  if (!result.results)
    return [];
  return result.results.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at
  }));
}
var init_monitoringService = __esm({
  "src/services/monitoringService.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_errorHandler();
    __name(getPlayerStatus, "getPlayerStatus");
    __name(updatePlayerStatus, "updatePlayerStatus");
    __name(getAllMonitoredPlayers, "getAllMonitoredPlayers");
    __name(getMonitoringStatus, "getMonitoringStatus");
    __name(getTotalMonitoredPlayers, "getTotalMonitoredPlayers");
    __name(getActiveGamesCount, "getActiveGamesCount");
    __name(getRecentMonitoringJobs, "getRecentMonitoringJobs");
  }
});

// src/services/emailService.ts
var emailService_exports = {};
__export(emailService_exports, {
  sendNotificationEmail: () => sendNotificationEmail
});
async function sendNotificationEmail(env, userId, type, data) {
  const notificationId = await generateSecureId();
  try {
    const user = await getUserById(env.DB, userId);
    if (!user) {
      throw createApiError("User not found", 404, "USER_NOT_FOUND");
    }
    const template = EMAIL_TEMPLATES[type];
    const subject = template.subject(data.playerName);
    const html = template.html(data).replace("{{settingsUrl}}", `${getBaseUrl()}/settings`).replace("{{unsubscribeUrl}}", `${getBaseUrl()}/unsubscribe/${userId}/${data.playerName}`);
    const text = template.text(data).replace("{{settingsUrl}}", `${getBaseUrl()}/settings`).replace("{{unsubscribeUrl}}", `${getBaseUrl()}/unsubscribe/${userId}/${data.playerName}`);
    const emailResult = await sendEmail({
      to: user.email,
      subject,
      html,
      text
    }, env);
    await logNotificationSent(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      emailDelivered: emailResult.success
    });
    return {
      notificationId,
      delivered: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error
    };
  } catch (error) {
    console.error("Send notification email error:", error);
    await logNotificationSent(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      emailDelivered: false
    }).catch((logError) => console.error("Failed to log notification failure:", logError));
    return {
      notificationId,
      delivered: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendEmail(email, env) {
  try {
    if (env.RESEND_API_KEY) {
      return await sendWithResend(email, env.RESEND_API_KEY);
    }
    throw createApiError("No email service configured", 500, "EMAIL_SERVICE_NOT_CONFIGURED");
  } catch (error) {
    console.error("Send email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email send failed"
    };
  }
}
async function sendWithResend(email, apiKey) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Chess.com Helper <notifications@chesshelper.app>",
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw createApiError(
        `Resend API error: ${response.status}`,
        502,
        "EMAIL_SERVICE_ERROR",
        errorData
      );
    }
    const result = await response.json();
    return {
      success: true,
      messageId: result.id
    };
  } catch (error) {
    console.error("Resend email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Resend API failed"
    };
  }
}
function getBaseUrl() {
  return "https://chesshelper.app";
}
var EMAIL_TEMPLATES;
var init_emailService = __esm({
  "src/services/emailService.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_crypto();
    init_errorHandler();
    init_notificationService();
    init_userService();
    EMAIL_TEMPLATES = {
      game_started: {
        subject: (playerName) => `\u{1F3AF} ${playerName} is now playing on Chess.com!`,
        html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">\u265F\uFE0F Game Alert</h2>
        <p><strong>${data.playerName}</strong> just started a new game on Chess.com!</p>
        ${data.gameUrl ? `
          <p>
            <a href="${data.gameUrl}" 
               style="background: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Watch Live Game
            </a>
          </p>
        ` : ""}
        <hr style="margin: 20px 0; border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This notification was sent by Chess.com Helper.<br>
          <a href="{{unsubscribeUrl}}">Unsubscribe from ${data.playerName}</a> | 
          <a href="{{settingsUrl}}">Manage all subscriptions</a>
        </p>
      </div>
    `,
        text: (data) => `
\u265F\uFE0F Game Alert

${data.playerName} just started a new game on Chess.com!

${data.gameUrl ? `Watch the game live: ${data.gameUrl}` : ""}

---
This notification was sent by Chess.com Helper.
Manage your subscriptions: {{settingsUrl}}
    `
      },
      game_ended: {
        subject: (playerName) => `\u265F\uFE0F ${playerName}'s game has ended`,
        html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">\u265F\uFE0F Game Complete</h2>
        <p><strong>${data.playerName}</strong>'s game on Chess.com has finished.</p>
        ${data.result ? `<p><strong>Result:</strong> ${data.result}</p>` : ""}
        <hr style="margin: 20px 0; border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This notification was sent by Chess.com Helper.<br>
          <a href="{{unsubscribeUrl}}">Unsubscribe from ${data.playerName}</a> | 
          <a href="{{settingsUrl}}">Manage all subscriptions</a>
        </p>
      </div>
    `,
        text: (data) => `
\u265F\uFE0F Game Complete

${data.playerName}'s game on Chess.com has finished.
${data.result ? `Result: ${data.result}` : ""}

---
This notification was sent by Chess.com Helper.
Manage your subscriptions: {{settingsUrl}}
    `
      }
    };
    __name(sendNotificationEmail, "sendNotificationEmail");
    __name(sendEmail, "sendEmail");
    __name(sendWithResend, "sendWithResend");
    __name(getBaseUrl, "getBaseUrl");
  }
});

// src/services/notificationService.ts
var notificationService_exports = {};
__export(notificationService_exports, {
  getNotificationHistory: () => getNotificationHistory,
  getNotificationPreferences: () => getNotificationPreferences,
  logNotificationSent: () => logNotificationSent,
  queueNotification: () => queueNotification,
  shouldSendNotification: () => shouldSendNotification,
  updateNotificationPreferences: () => updateNotificationPreferences
});
async function getNotificationPreferences(db, userId) {
  try {
    const result = await db.prepare(`
      SELECT user_id, email_notifications, notification_frequency, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ?
    `).bind(userId).first();
    if (!result)
      return null;
    return {
      userId: result.user_id,
      emailNotifications: Boolean(result.email_notifications),
      notificationFrequency: result.notification_frequency,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  } catch (error) {
    console.error("Get notification preferences error:", error);
    throw createApiError("Failed to fetch notification preferences", 500, "NOTIFICATION_PREFERENCES_FETCH_FAILED", error);
  }
}
async function updateNotificationPreferences(db, userId, updates) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const updateFields = [];
    const values = [];
    if (updates.emailNotifications !== void 0) {
      updateFields.push("email_notifications = ?");
      values.push(updates.emailNotifications);
    }
    if (updates.notificationFrequency) {
      updateFields.push("notification_frequency = ?");
      values.push(updates.notificationFrequency);
    }
    if (updateFields.length === 0) {
      throw createApiError("No valid fields to update", 400, "INVALID_UPDATE_DATA");
    }
    updateFields.push("updated_at = ?");
    values.push(now, userId);
    await db.prepare(`
      UPDATE user_preferences 
      SET ${updateFields.join(", ")}
      WHERE user_id = ?
    `).bind(...values).run();
    const preferences = await getNotificationPreferences(db, userId);
    if (!preferences) {
      throw createApiError("Failed to retrieve updated preferences", 500, "PREFERENCES_UPDATE_FAILED");
    }
    return preferences;
  } catch (error) {
    console.error("Update notification preferences error:", error);
    throw createApiError("Failed to update notification preferences", 500, "NOTIFICATION_PREFERENCES_UPDATE_FAILED", error);
  }
}
async function getNotificationHistory(db, userId, options) {
  try {
    const result = await db.prepare(`
      SELECT id, user_id, chess_com_username, notification_type, sent_at, email_delivered
      FROM notification_log
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, options.limit, options.offset).all();
    if (!result.results)
      return [];
    return result.results.map((row) => ({
      id: row.id,
      userId: row.user_id,
      chessComUsername: row.chess_com_username,
      notificationType: row.notification_type,
      sentAt: row.sent_at,
      emailDelivered: Boolean(row.email_delivered)
    }));
  } catch (error) {
    console.error("Get notification history error:", error);
    throw createApiError("Failed to fetch notification history", 500, "NOTIFICATION_HISTORY_FETCH_FAILED", error);
  }
}
async function logNotificationSent(db, notification) {
  const id = await generateSecureId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const result = await db.prepare(`
      INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      notification.userId,
      notification.chessComUsername,
      notification.notificationType,
      now,
      notification.emailDelivered
    ).run();
    if (!result.success) {
      throw createApiError("Failed to log notification", 500, "NOTIFICATION_LOG_FAILED");
    }
    return {
      id,
      userId: notification.userId,
      chessComUsername: notification.chessComUsername,
      notificationType: notification.notificationType,
      sentAt: now,
      emailDelivered: notification.emailDelivered
    };
  } catch (error) {
    console.error("Log notification sent error:", error);
    throw createApiError("Failed to log notification", 500, "NOTIFICATION_LOG_FAILED", error);
  }
}
async function queueNotification(db, notification) {
  const id = await generateSecureId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const recentNotification = await db.prepare(`
      SELECT id FROM notification_log
      WHERE user_id = ? AND chess_com_username = ? AND notification_type = ?
      AND sent_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).bind(notification.userId, notification.playerName, notification.eventType).first();
    if (recentNotification) {
      throw createApiError("Duplicate notification prevented", 409, "DUPLICATE_NOTIFICATION");
    }
    const emailResult = await Promise.resolve().then(() => (init_emailService(), emailService_exports)).then(
      (m) => m.sendNotificationEmail(
        { DB: db },
        // Simplified for this context
        notification.userId,
        notification.eventType,
        {
          playerName: notification.playerName,
          gameUrl: notification.gameUrl,
          result: notification.result
        }
      )
    );
    return {
      id,
      userId: notification.userId,
      playerName: notification.playerName,
      eventType: notification.eventType,
      gameUrl: notification.gameUrl,
      result: notification.result,
      queuedAt: now
    };
  } catch (error) {
    console.error("Queue notification error:", error);
    throw createApiError("Failed to queue notification", 500, "NOTIFICATION_QUEUE_FAILED", error);
  }
}
async function shouldSendNotification(db, userId, playerName, eventType) {
  try {
    const preferences = await getNotificationPreferences(db, userId);
    if (!preferences || !preferences.emailNotifications || preferences.notificationFrequency === "disabled") {
      return false;
    }
    const recentNotification = await db.prepare(`
      SELECT id FROM notification_log
      WHERE user_id = ? AND chess_com_username = ? AND notification_type = ?
      AND sent_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).bind(userId, playerName, eventType).first();
    return !recentNotification;
  } catch (error) {
    console.error("Should send notification check error:", error);
    return false;
  }
}
var init_notificationService = __esm({
  "src/services/notificationService.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_crypto();
    init_errorHandler();
    __name(getNotificationPreferences, "getNotificationPreferences");
    __name(updateNotificationPreferences, "updateNotificationPreferences");
    __name(getNotificationHistory, "getNotificationHistory");
    __name(logNotificationSent, "logNotificationSent");
    __name(queueNotification, "queueNotification");
    __name(shouldSendNotification, "shouldSendNotification");
  }
});

// src/jobs/playerMonitoring.ts
var playerMonitoring_exports = {};
__export(playerMonitoring_exports, {
  checkPlayerStatus: () => checkPlayerStatus,
  checkSpecificPlayers: () => checkSpecificPlayers
});
async function checkPlayerStatus(env, ctx) {
  const startTime = Date.now();
  const jobId = await generateSecureId();
  const errors = [];
  let playersChecked = 0;
  let notificationsSent = 0;
  try {
    await logJobStart(env.DB, jobId, "batch_poll");
    const monitoredPlayers = await getAllMonitoredPlayers(env.DB);
    if (monitoredPlayers.length === 0) {
      await logJobComplete(env.DB, jobId, "completed");
      return { playersChecked: 0, notificationsSent: 0, errors: [], duration: Date.now() - startTime };
    }
    console.log(`Starting monitoring check for ${monitoredPlayers.length} players`);
    const batchSize = 10;
    const batches = chunkArray(monitoredPlayers, batchSize);
    for (const batch of batches) {
      try {
        const playerStatuses = await batchGetPlayerStatuses(batch, env.CHESS_COM_API_URL);
        for (const status of playerStatuses) {
          try {
            const previousStatus = await getPlayerStatus(env.DB, status.username);
            await updatePlayerStatus(env.DB, status.username, {
              isOnline: status.isOnline,
              isPlaying: status.isPlaying,
              currentGameUrl: status.currentGames[0]?.url || null,
              lastSeen: status.isOnline ? (/* @__PURE__ */ new Date()).toISOString() : void 0
            });
            playersChecked++;
            const statusChanged = !previousStatus || previousStatus.isPlaying !== status.isPlaying;
            if (statusChanged && status.isPlaying && !previousStatus?.isPlaying) {
              const notificationCount = await sendGameStartedNotifications(
                env,
                status.username,
                status.currentGames[0]?.url
              );
              notificationsSent += notificationCount;
            }
            if (statusChanged && !status.isPlaying && previousStatus?.isPlaying) {
              const notificationCount = await sendGameEndedNotifications(
                env,
                status.username
              );
              notificationsSent += notificationCount;
            }
          } catch (playerError) {
            const errorMsg = `Error processing player ${status.username}: ${playerError}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      } catch (batchError) {
        const errorMsg = `Error processing batch: ${batchError}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    await logJobComplete(env.DB, jobId, "completed");
    console.log(`Monitoring check completed: ${playersChecked} players checked, ${notificationsSent} notifications sent`);
  } catch (error) {
    const errorMsg = `Monitoring job failed: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    await logJobComplete(env.DB, jobId, "failed", errorMsg);
  }
  return {
    playersChecked,
    notificationsSent,
    errors,
    duration: Date.now() - startTime
  };
}
async function checkSpecificPlayers(env, playernames) {
  const startTime = Date.now();
  const jobId = await generateSecureId();
  const errors = [];
  let playersChecked = 0;
  let notificationsSent = 0;
  try {
    await logJobStart(env.DB, jobId, "player_check");
    const playersToCheck = playernames || await getAllMonitoredPlayers(env.DB);
    if (playersToCheck.length === 0) {
      await logJobComplete(env.DB, jobId, "completed");
      return { playersChecked: 0, notificationsSent: 0, errors: [], duration: Date.now() - startTime };
    }
    console.log(`Checking specific players: ${playersToCheck.join(", ")}`);
    for (const playerName of playersToCheck) {
      try {
        const status = await getPlayerGameStatus(playerName, env.CHESS_COM_API_URL);
        const previousStatus = await getPlayerStatus(env.DB, playerName);
        await updatePlayerStatus(env.DB, playerName, {
          isOnline: status.isOnline,
          isPlaying: status.isPlaying,
          currentGameUrl: status.currentGames[0]?.url || null,
          lastSeen: status.isOnline ? (/* @__PURE__ */ new Date()).toISOString() : void 0
        });
        playersChecked++;
        const statusChanged = !previousStatus || previousStatus.isPlaying !== status.isPlaying;
        if (statusChanged && status.isPlaying && !previousStatus?.isPlaying) {
          const notificationCount = await sendGameStartedNotifications(
            env,
            playerName,
            status.currentGames[0]?.url
          );
          notificationsSent += notificationCount;
        }
      } catch (playerError) {
        const errorMsg = `Error checking player ${playerName}: ${playerError}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await logJobComplete(env.DB, jobId, "completed");
  } catch (error) {
    const errorMsg = `Player check job failed: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    await logJobComplete(env.DB, jobId, "failed", errorMsg);
  }
  return {
    playersChecked,
    notificationsSent,
    errors,
    duration: Date.now() - startTime
  };
}
async function sendGameStartedNotifications(env, playerName, gameUrl) {
  try {
    const subscribers = await getSubscribersForPlayer(env.DB, playerName);
    let notificationsSent = 0;
    for (const userId of subscribers) {
      try {
        const shouldSend = await shouldSendNotification(env.DB, userId, playerName, "game_started");
        if (shouldSend) {
          await queueNotification(env.DB, {
            userId,
            playerName,
            eventType: "game_started",
            gameUrl
          });
          notificationsSent++;
        }
      } catch (error) {
        console.error(`Failed to send game started notification to user ${userId}:`, error);
      }
    }
    return notificationsSent;
  } catch (error) {
    console.error(`Failed to send game started notifications for ${playerName}:`, error);
    return 0;
  }
}
async function sendGameEndedNotifications(env, playerName) {
  try {
    const subscribers = await getSubscribersForPlayer(env.DB, playerName);
    let notificationsSent = 0;
    for (const userId of subscribers) {
      try {
        const shouldSend = await shouldSendNotification(env.DB, userId, playerName, "game_ended");
        if (shouldSend) {
          await queueNotification(env.DB, {
            userId,
            playerName,
            eventType: "game_ended"
          });
          notificationsSent++;
        }
      } catch (error) {
        console.error(`Failed to send game ended notification to user ${userId}:`, error);
      }
    }
    return notificationsSent;
  } catch (error) {
    console.error(`Failed to send game ended notifications for ${playerName}:`, error);
    return 0;
  }
}
async function logJobStart(db, jobId, jobType) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`
      INSERT INTO monitoring_jobs (id, job_type, status, started_at, created_at)
      VALUES (?, ?, 'running', ?, ?)
    `).bind(jobId, jobType, now, now).run();
  } catch (error) {
    console.error("Failed to log job start:", error);
  }
}
async function logJobComplete(db, jobId, status, errorMessage) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`
      UPDATE monitoring_jobs
      SET status = ?, completed_at = ?, error_message = ?
      WHERE id = ?
    `).bind(status, now, errorMessage || null, jobId).run();
  } catch (error) {
    console.error("Failed to log job completion:", error);
  }
}
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
var init_playerMonitoring = __esm({
  "src/jobs/playerMonitoring.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_crypto();
    init_monitoringService();
    init_chessComService();
    init_subscriptionService();
    init_notificationService();
    __name(checkPlayerStatus, "checkPlayerStatus");
    __name(checkSpecificPlayers, "checkSpecificPlayers");
    __name(sendGameStartedNotifications, "sendGameStartedNotifications");
    __name(sendGameEndedNotifications, "sendGameEndedNotifications");
    __name(logJobStart, "logJobStart");
    __name(logJobComplete, "logJobComplete");
    __name(chunkArray, "chunkArray");
  }
});

// src/jobs/cleanup.ts
var cleanup_exports = {};
__export(cleanup_exports, {
  cleanupExpiredAgentResults: () => cleanupExpiredAgentResults,
  cleanupExpiredTasks: () => cleanupExpiredTasks,
  cleanupOrphanedPlayerStatuses: () => cleanupOrphanedPlayerStatuses,
  optimizeDatabaseTables: () => optimizeDatabaseTables
});
async function cleanupExpiredTasks(env, ctx) {
  const startTime = Date.now();
  const jobId = await generateSecureId();
  const errors = [];
  let expiredTasksRemoved = 0;
  let oldNotificationsRemoved = 0;
  let oldJobsRemoved = 0;
  try {
    await logCleanupJobStart(env.DB, jobId);
    expiredTasksRemoved = await cleanupOldAgentTasks(env.DB);
    oldNotificationsRemoved = await cleanupOldNotificationLogs(env.DB);
    oldJobsRemoved = await cleanupOldMonitoringJobs(env.DB);
    await logCleanupJobComplete(env.DB, jobId, "completed");
    console.log(`Cleanup completed: ${expiredTasksRemoved} tasks, ${oldNotificationsRemoved} notifications, ${oldJobsRemoved} jobs removed`);
  } catch (error) {
    const errorMsg = `Cleanup job failed: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    await logCleanupJobComplete(env.DB, jobId, "failed", errorMsg);
  }
  return {
    expiredTasksRemoved,
    oldNotificationsRemoved,
    oldJobsRemoved,
    errors,
    duration: Date.now() - startTime
  };
}
async function cleanupOldAgentTasks(db) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
    const result = await db.prepare(`
      DELETE FROM agent_tasks
      WHERE (status IN ('completed', 'failed') AND completed_at < ?)
         OR (status = 'pending' AND created_at < ?)
    `).bind(thirtyDaysAgo, thirtyDaysAgo).run();
    console.log(`Cleaned up ${result.changes || 0} old agent tasks`);
    return result.changes || 0;
  } catch (error) {
    console.error("Failed to cleanup old agent tasks:", error);
    return 0;
  }
}
async function cleanupOldNotificationLogs(db) {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3).toISOString();
    const result = await db.prepare(`
      DELETE FROM notification_log
      WHERE sent_at < ?
    `).bind(ninetyDaysAgo).run();
    console.log(`Cleaned up ${result.changes || 0} old notification logs`);
    return result.changes || 0;
  } catch (error) {
    console.error("Failed to cleanup old notification logs:", error);
    return 0;
  }
}
async function cleanupOldMonitoringJobs(db) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
    const result = await db.prepare(`
      DELETE FROM monitoring_jobs
      WHERE (status IN ('completed', 'failed') AND completed_at < ?)
         OR (status = 'pending' AND created_at < ?)
    `).bind(sevenDaysAgo, sevenDaysAgo).run();
    console.log(`Cleaned up ${result.changes || 0} old monitoring jobs`);
    return result.changes || 0;
  } catch (error) {
    console.error("Failed to cleanup old monitoring jobs:", error);
    return 0;
  }
}
async function cleanupOrphanedPlayerStatuses(env) {
  try {
    const result = await env.DB.prepare(`
      DELETE FROM player_status
      WHERE chess_com_username NOT IN (
        SELECT DISTINCT chess_com_username FROM player_subscriptions
      )
    `).run();
    console.log(`Cleaned up ${result.changes || 0} orphaned player statuses`);
    return result.changes || 0;
  } catch (error) {
    console.error("Failed to cleanup orphaned player statuses:", error);
    return 0;
  }
}
async function cleanupExpiredAgentResults(env) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
    const result = await env.DB.prepare(`
      DELETE FROM agent_results
      WHERE created_at < ?
        AND task_id NOT IN (
          SELECT id FROM agent_tasks WHERE status = 'processing'
        )
    `).bind(sevenDaysAgo).run();
    console.log(`Cleaned up ${result.changes || 0} expired agent results`);
    return result.changes || 0;
  } catch (error) {
    console.error("Failed to cleanup expired agent results:", error);
    return 0;
  }
}
async function optimizeDatabaseTables(env) {
  try {
    await env.DB.prepare("PRAGMA vacuum").run();
    await env.DB.prepare("PRAGMA analyze").run();
    console.log("Database optimization completed");
  } catch (error) {
    console.error("Failed to optimize database:", error);
  }
}
async function logCleanupJobStart(db, jobId) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`
      INSERT INTO monitoring_jobs (id, job_type, status, started_at, created_at)
      VALUES (?, 'cleanup', 'running', ?, ?)
    `).bind(jobId, now, now).run();
  } catch (error) {
    console.error("Failed to log cleanup job start:", error);
  }
}
async function logCleanupJobComplete(db, jobId, status, errorMessage) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`
      UPDATE monitoring_jobs
      SET status = ?, completed_at = ?, error_message = ?
      WHERE id = ?
    `).bind(status, now, errorMessage || null, jobId).run();
  } catch (error) {
    console.error("Failed to log cleanup job completion:", error);
  }
}
var init_cleanup = __esm({
  "src/jobs/cleanup.ts"() {
    "use strict";
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    init_crypto();
    __name(cleanupExpiredTasks, "cleanupExpiredTasks");
    __name(cleanupOldAgentTasks, "cleanupOldAgentTasks");
    __name(cleanupOldNotificationLogs, "cleanupOldNotificationLogs");
    __name(cleanupOldMonitoringJobs, "cleanupOldMonitoringJobs");
    __name(cleanupOrphanedPlayerStatuses, "cleanupOrphanedPlayerStatuses");
    __name(cleanupExpiredAgentResults, "cleanupExpiredAgentResults");
    __name(optimizeDatabaseTables, "optimizeDatabaseTables");
    __name(logCleanupJobStart, "logCleanupJobStart");
    __name(logCleanupJobComplete, "logCleanupJobComplete");
  }
});

// .wrangler/tmp/bundle-SphtKo/middleware-loader.entry.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// .wrangler/tmp/bundle-SphtKo/middleware-insertion-facade.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/index.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();

// src/routes/auth.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
init_crypto();

// src/utils/jwt.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
async function generateToken(userId, secret, expiresIn = 86400) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + expiresIn
  };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(signatureInput, secret);
  return `${signatureInput}.${signature}`;
}
__name(generateToken, "generateToken");
async function verifyToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await sign(signatureInput, secret);
    if (signature !== expectedSignature) {
      return null;
    }
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}
__name(verifyToken, "verifyToken");
async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64urlEncode(new Uint8Array(signature));
}
__name(sign, "sign");
function base64urlEncode(data) {
  let str;
  if (typeof data === "string") {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    str = btoa(String.fromCharCode(...data));
  }
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64urlEncode, "base64urlEncode");
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return decodeURIComponent(escape(atob(str)));
}
__name(base64urlDecode, "base64urlDecode");

// src/utils/validation.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function validateEmail(email) {
  if (!email || typeof email !== "string")
    return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}
__name(validateEmail, "validateEmail");
function validatePassword(password) {
  if (!password || typeof password !== "string")
    return false;
  if (password.length < 8 || password.length > 128)
    return false;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
}
__name(validatePassword, "validatePassword");
function validateChessComUsername(username) {
  if (!username || typeof username !== "string")
    return false;
  if (username.length < 3 || username.length > 25)
    return false;
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  return usernameRegex.test(username);
}
__name(validateChessComUsername, "validateChessComUsername");
function validateNotificationFrequency(frequency) {
  const validFrequencies = ["immediate", "digest", "disabled"];
  return validFrequencies.includes(frequency);
}
__name(validateNotificationFrequency, "validateNotificationFrequency");

// src/routes/auth.ts
init_userService();
var router = t({ base: "/api/v1/auth" });
router.post("/register", async (request, env) => {
  try {
    const body = await request.json();
    if (!validateEmail(body.email)) {
      return s(400, "Invalid email format");
    }
    if (!validatePassword(body.password)) {
      return s(400, "Password must be at least 8 characters with uppercase, lowercase, number, and special character");
    }
    const existingUser = await getUserByEmail(env.DB, body.email);
    if (existingUser) {
      return s(400, "User already exists");
    }
    const passwordHash = await hashPassword(body.password);
    const user = await createUser(env.DB, {
      email: body.email,
      passwordHash
    });
    const token = await generateToken(user.id, env.JWT_SECRET);
    return o({
      userId: user.id,
      email: user.email,
      token,
      createdAt: user.createdAt
    }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return s(500, "Registration failed");
  }
});
router.post("/login", async (request, env) => {
  try {
    const body = await request.json();
    if (!validateEmail(body.email) || !body.password) {
      return s(400, "Invalid email or password");
    }
    const user = await getUserByEmail(env.DB, body.email);
    if (!user) {
      return s(401, "Invalid credentials");
    }
    const isValidPassword = await verifyPassword(body.password, user.passwordHash);
    if (!isValidPassword) {
      return s(401, "Invalid credentials");
    }
    const token = await generateToken(user.id, env.JWT_SECRET);
    return o({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return s(500, "Login failed");
  }
});
router.post("/logout", async (request, env) => {
  return o({ message: "Logged out successfully" });
});
router.post("/forgot-password", async (request, env) => {
  try {
    const body = await request.json();
    if (!validateEmail(body.email)) {
      return s(400, "Invalid email format");
    }
    const user = await getUserByEmail(env.DB, body.email);
    if (!user) {
      return o({ message: "If an account exists, a reset email will be sent" });
    }
    console.log("Password reset requested for:", body.email);
    return o({ message: "If an account exists, a reset email will be sent" });
  } catch (err) {
    console.error("Password reset error:", err);
    return s(500, "Password reset failed");
  }
});

// src/routes/users.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
init_userService();
init_subscriptionService();

// src/services/preferencesService.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_errorHandler();
async function getUserPreferences(db, userId) {
  try {
    let result = await db.prepare(`
      SELECT user_id, email_notifications, notification_frequency, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ?
    `).bind(userId).first();
    if (!result) {
      result = await createDefaultUserPreferences(db, userId);
    }
    return {
      userId: result.user_id,
      emailNotifications: Boolean(result.email_notifications),
      notificationFrequency: result.notification_frequency,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  } catch (error) {
    console.error("Get user preferences error:", error);
    throw createApiError("Failed to fetch user preferences", 500, "PREFERENCES_FETCH_FAILED", error);
  }
}
__name(getUserPreferences, "getUserPreferences");
async function updateUserPreferences(db, userId, updateData) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updates = [];
  const values = [];
  if (updateData.emailNotifications !== void 0) {
    updates.push("email_notifications = ?");
    values.push(updateData.emailNotifications);
  }
  if (updateData.notificationFrequency) {
    if (!validateNotificationFrequency(updateData.notificationFrequency)) {
      throw createApiError("Invalid notification frequency", 400, "INVALID_NOTIFICATION_FREQUENCY");
    }
    updates.push("notification_frequency = ?");
    values.push(updateData.notificationFrequency);
  }
  if (updates.length === 0) {
    throw createApiError("No valid fields to update", 400, "INVALID_UPDATE_DATA");
  }
  updates.push("updated_at = ?");
  values.push(now, userId);
  try {
    await db.prepare(`
      INSERT INTO user_preferences (user_id, email_notifications, notification_frequency, created_at, updated_at)
      VALUES (?, true, 'immediate', ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET ${updates.join(", ")}
      WHERE user_id = ?
    `).bind(userId, now, now, ...values).run();
    return await getUserPreferences(db, userId);
  } catch (error) {
    console.error("Update user preferences error:", error);
    throw createApiError("Failed to update user preferences", 500, "PREFERENCES_UPDATE_FAILED", error);
  }
}
__name(updateUserPreferences, "updateUserPreferences");
async function createDefaultUserPreferences(db, userId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await db.prepare(`
      INSERT INTO user_preferences (user_id, email_notifications, notification_frequency, created_at, updated_at)
      VALUES (?, true, 'immediate', ?, ?)
    `).bind(userId, now, now).run();
    return {
      user_id: userId,
      email_notifications: true,
      notification_frequency: "immediate",
      created_at: now,
      updated_at: now
    };
  } catch (error) {
    console.error("Create default preferences error:", error);
    throw createApiError("Failed to create default preferences", 500, "PREFERENCES_CREATION_FAILED", error);
  }
}
__name(createDefaultUserPreferences, "createDefaultUserPreferences");

// src/routes/users.ts
init_chessComService();
var router2 = t({ base: "/api/v1/users" });
router2.get("/me", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const user = await getUserById(env.DB, userId);
    if (!user) {
      return s(404, "User not found");
    }
    return o({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (err) {
    console.error("Get user error:", err);
    return s(500, "Failed to fetch user");
  }
});
router2.put("/me", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const body = await request.json();
    const updatedUser = await updateUser(env.DB, userId, body);
    return o({
      id: updatedUser.id,
      email: updatedUser.email,
      updatedAt: updatedUser.updatedAt
    });
  } catch (err) {
    console.error("Update user error:", err);
    return s(500, "Failed to update user");
  }
});
router2.delete("/me", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    await deleteUser(env.DB, userId);
    return o({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    return s(500, "Failed to delete account");
  }
});
router2.get("/me/subscriptions", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const subscriptions = await getPlayerSubscriptions(env.DB, userId);
    return o({ subscriptions });
  } catch (err) {
    console.error("Get subscriptions error:", err);
    return s(500, "Failed to fetch subscriptions");
  }
});
router2.post("/me/subscriptions", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const body = await request.json();
    if (!validateChessComUsername(body.chessComUsername)) {
      return s(400, "Invalid Chess.com username");
    }
    const playerExists = await verifyPlayerExists(body.chessComUsername, env.CHESS_COM_API_URL);
    if (!playerExists) {
      return s(404, "Chess.com player not found");
    }
    const subscription = await createPlayerSubscription(env.DB, {
      userId,
      chessComUsername: body.chessComUsername
    });
    return o({
      id: subscription.id,
      chessComUsername: subscription.chessComUsername,
      createdAt: subscription.createdAt
    }, { status: 201 });
  } catch (err) {
    console.error("Create subscription error:", err);
    return s(500, "Failed to create subscription");
  }
});
router2.delete("/me/subscriptions", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const body = await request.json();
    if (!validateChessComUsername(body.chessComUsername)) {
      return s(400, "Invalid Chess.com username");
    }
    await deletePlayerSubscription(env.DB, userId, body.chessComUsername);
    return o({ message: "Subscription removed successfully" });
  } catch (err) {
    console.error("Delete subscription error:", err);
    return s(500, "Failed to remove subscription");
  }
});
router2.get("/me/preferences", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const preferences = await getUserPreferences(env.DB, userId);
    return o({ preferences });
  } catch (err) {
    console.error("Get preferences error:", err);
    return s(500, "Failed to fetch preferences");
  }
});
router2.put("/me/preferences", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const body = await request.json();
    const preferences = await updateUserPreferences(env.DB, userId, body);
    return o({ preferences });
  } catch (err) {
    console.error("Update preferences error:", err);
    return s(500, "Failed to update preferences");
  }
});

// src/routes/monitoring.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
init_monitoringService();
var router3 = t({ base: "/api/v1/monitoring" });
router3.get("/status", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const status = await getMonitoringStatus(env.DB);
    return o(status);
  } catch (err) {
    console.error("Get monitoring status error:", err);
    return s(500, "Failed to fetch monitoring status");
  }
});
router3.get("/players/:username", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const username = request.params?.username;
    if (!username || !validateChessComUsername(username)) {
      return s(400, "Invalid Chess.com username");
    }
    const playerStatus = await getPlayerStatus(env.DB, username);
    if (!playerStatus) {
      return s(404, "Player not found in monitoring system");
    }
    return o({
      username: playerStatus.chessComUsername,
      isOnline: playerStatus.isOnline,
      isPlaying: playerStatus.isPlaying,
      currentGameUrl: playerStatus.currentGameUrl,
      lastSeen: playerStatus.lastSeen,
      lastChecked: playerStatus.lastChecked
    });
  } catch (err) {
    console.error("Get player status error:", err);
    return s(500, "Failed to fetch player status");
  }
});
router3.post("/internal/check", async (request, env) => {
  try {
    const body = await request.json();
    if (body.playernames && !Array.isArray(body.playernames)) {
      return s(400, "Playernames must be an array");
    }
    const checkResult = await Promise.resolve().then(() => (init_playerMonitoring(), playerMonitoring_exports)).then(
      (m) => m.checkSpecificPlayers(env, body.playernames)
    );
    return o({
      message: "Player check initiated",
      playersChecked: checkResult.playersChecked,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Manual player check error:", err);
    return s(500, "Failed to initiate player check");
  }
});
router3.post("/internal/poll", async (request, env) => {
  try {
    const pollResult = await Promise.resolve().then(() => (init_playerMonitoring(), playerMonitoring_exports)).then(
      (m) => m.checkPlayerStatus(env, null)
    );
    return o({
      message: "Polling completed",
      playersChecked: pollResult.playersChecked,
      notificationsSent: pollResult.notificationsSent,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Manual polling error:", err);
    return s(500, "Failed to complete polling");
  }
});

// src/routes/notifications.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
init_notificationService();
init_notificationService();
var router4 = t({ base: "/api/v1/notifications" });
router4.get("/preferences", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const preferences = await getNotificationPreferences(env.DB, userId);
    return o({ preferences });
  } catch (err) {
    console.error("Get notification preferences error:", err);
    return s(500, "Failed to fetch notification preferences");
  }
});
router4.put("/preferences", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const body = await request.json();
    const preferences = await updateNotificationPreferences(env.DB, userId, body);
    return o({ preferences });
  } catch (err) {
    console.error("Update notification preferences error:", err);
    return s(500, "Failed to update notification preferences");
  }
});
router4.get("/history", async (request, env) => {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return s(401, "Unauthorized");
    }
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const history = await getNotificationHistory(env.DB, userId, { limit, offset });
    return o({
      notifications: history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
      }
    });
  } catch (err) {
    console.error("Get notification history error:", err);
    return s(500, "Failed to fetch notification history");
  }
});
router4.post("/internal/send", async (request, env) => {
  try {
    const body = await request.json();
    if (!body.userId || !body.type || !body.data?.playerName) {
      return s(400, "Missing required fields");
    }
    const sendResult = await Promise.resolve().then(() => (init_emailService(), emailService_exports)).then(
      (m) => m.sendNotificationEmail(env, body.userId, body.type, body.data)
    );
    return o({
      message: "Notification sent",
      notificationId: sendResult.notificationId,
      delivered: sendResult.delivered,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Send notification error:", err);
    return s(500, "Failed to send notification");
  }
});
router4.post("/internal/queue", async (request, env) => {
  try {
    const body = await request.json();
    if (!body.userId || !body.playerName || !body.eventType) {
      return s(400, "Missing required fields");
    }
    const queueResult = await Promise.resolve().then(() => (init_notificationService(), notificationService_exports)).then(
      (m) => m.queueNotification(env.DB, body)
    );
    return o({
      message: "Notification queued",
      queueId: queueResult.id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Queue notification error:", err);
    return s(500, "Failed to queue notification");
  }
});

// src/middleware/auth.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
async function authenticateUser(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return s(401, "Missing or invalid authorization header");
  }
  const token = authHeader.substring(7);
  try {
    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload || !payload.userId) {
      return s(401, "Invalid token");
    }
    request.user = {
      id: payload.userId,
      email: payload.email || ""
    };
  } catch (err) {
    console.error("Token verification error:", err);
    return s(401, "Invalid or expired token");
  }
}
__name(authenticateUser, "authenticateUser");

// src/middleware/validation.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
var MAX_BODY_SIZE = 1024 * 1024;
async function validateRequest(request, env) {
  if (request.method === "OPTIONS") {
    return;
  }
  const url = new URL(request.url);
  if (url.pathname === "/favicon.ico" || url.pathname === "/health") {
    return;
  }
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    const contentType = request.headers.get("content-type");
    if (!contentType) {
      return s(400, "Content-Type header is required");
    }
    if (!contentType.includes("application/json")) {
      return s(400, "Content-Type must be application/json");
    }
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return s(413, "Request body too large");
    }
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.text();
      if (body.length > MAX_BODY_SIZE) {
        return s(413, "Request body too large");
      }
      if (body.trim()) {
        JSON.parse(body);
      }
    } catch (err) {
      return s(400, "Invalid JSON in request body");
    }
  }
  const userAgent = request.headers.get("user-agent");
  if (userAgent && userAgent.length > 500) {
    return s(400, "User-Agent header too long");
  }
}
__name(validateRequest, "validateRequest");

// src/middleware/rateLimit.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
init_itty_router();
var RATE_LIMITS = {
  default: { requests: 100, window: 3600 },
  // 100 requests per hour
  auth: { requests: 10, window: 900 },
  // 10 requests per 15 minutes
  api: { requests: 1e3, window: 3600 }
  // 1000 requests per hour for authenticated users
};
async function rateLimiter(request, env) {
  if (request.method === "OPTIONS") {
    return;
  }
  const clientId = getClientId(request);
  const endpoint = getEndpointType(request.url);
  const limit = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const key = `rate_limit:${endpoint}:${clientId}`;
  const now = Math.floor(Date.now() / 1e3);
  const windowStart = now - limit.window;
  try {
    const current = await env.CACHE.get(key);
    let requests = current ? JSON.parse(current) : [];
    requests = requests.filter((timestamp) => timestamp > windowStart);
    if (requests.length >= limit.requests) {
      const resetTime2 = requests[0] + limit.window;
      return s(429, "Rate limit exceeded", {
        headers: {
          "Retry-After": String(resetTime2 - now),
          "X-RateLimit-Limit": String(limit.requests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetTime2)
        }
      });
    }
    requests.push(now);
    await env.CACHE.put(key, JSON.stringify(requests), { expirationTtl: limit.window });
    const remaining = limit.requests - requests.length;
    const resetTime = requests[0] + limit.window;
    request.rateLimitInfo = {
      limit: limit.requests,
      remaining,
      reset: resetTime
    };
  } catch (err) {
    console.error("Rate limiting error:", err);
  }
}
__name(rateLimiter, "rateLimiter");
function getClientId(request) {
  const forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || request.headers.get("X-Real-IP");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return `user:${authHeader.substring(7, 20)}`;
  }
  return "anonymous";
}
__name(getClientId, "getClientId");
function getEndpointType(url) {
  if (url.includes("/auth/"))
    return "auth";
  if (url.includes("/api/"))
    return "api";
  return "default";
}
__name(getEndpointType, "getEndpointType");

// src/index.ts
init_errorHandler();
var { preflight, corsify } = y({
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  origins: ["*"],
  headers: ["Authorization", "Content-Type"]
});
var router5 = t();
router5.get("/health", () => o({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
router5.get("/favicon.ico", () => new Response(null, { status: 204 }));
router5.all("/api/*", preflight).all("/api/*", rateLimiter).all("/api/*", validateRequest);
router5.all("/api/v1/auth/*", router.handle);
router5.all("/api/v1/users/*", authenticateUser, router2.handle);
router5.all("/api/v1/monitoring/*", authenticateUser, router3.handle);
router5.all("/api/v1/notifications/*", authenticateUser, router4.handle);
router5.all("*", () => s(404, "Not Found"));
var src_default = {
  async fetch(request, env, ctx) {
    try {
      const response = await router5.handle(request, env, ctx);
      if (request.rateLimitInfo) {
        const info = request.rateLimitInfo;
        response.headers.set("X-RateLimit-Limit", String(info.limit));
        response.headers.set("X-RateLimit-Remaining", String(info.remaining));
        response.headers.set("X-RateLimit-Reset", String(info.reset));
      }
      return corsify(response);
    } catch (err) {
      return errorHandler(err);
    }
  },
  async scheduled(event, env, ctx) {
    try {
      switch (event.cron) {
        case "*/5 * * * *":
          await Promise.resolve().then(() => (init_playerMonitoring(), playerMonitoring_exports)).then((m) => m.checkPlayerStatus(env, ctx)).catch((err) => {
            console.error("Player monitoring job failed:", err);
            throw err;
          });
          break;
        case "0 */6 * * *":
          await Promise.resolve().then(() => (init_cleanup(), cleanup_exports)).then((m) => m.cleanupExpiredTasks(env, ctx)).catch((err) => {
            console.error("Cleanup job failed:", err);
            throw err;
          });
          break;
      }
    } catch (err) {
      console.error("Scheduled job error:", err);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
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
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
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

// .wrangler/tmp/bundle-SphtKo/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
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

// .wrangler/tmp/bundle-SphtKo/middleware-loader.entry.ts
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
