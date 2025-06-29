import { Router } from 'itty-router';
import { DatabaseService } from '../services/database';
import { ChesscomAPI } from '../services/chesscom-api';
import { corsHeaders } from '../utils/cors';

const apiRouter = Router({ base: '/api' });

// Helper function to hash passwords using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to verify passwords
async function verifyPassword(password, hashedPassword) {
  const hashedInput = await hashPassword(password);
  return hashedInput === hashedPassword;
}

// Helper function to generate simple JWT-like token
function generateToken(username) {
  const payload = {
    username,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  return btoa(JSON.stringify(payload));
}

// CORS preflight handler
apiRouter.options('*', () => new Response(null, { 
  status: 204, 
  headers: corsHeaders() 
}));

// POST /api/accounts/register/ - User registration
apiRouter.post('/accounts/register/', async (request, env) => {
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }

  try {
    const { username, email, password, password2 } = await request.json();
    
    // Validate required fields
    if (!username || !email || !password || !password2) {
      return Response.json({ 
        error: 'All fields are required' 
      }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Validate password match
    if (password !== password2) {
      return Response.json({ 
        password2: ['Passwords do not match'] 
      }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ 
        email: ['Invalid email format'] 
      }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Check if user already exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM auth_users WHERE username = ? OR email = ?'
    ).bind(username, email).first();
    
    if (existingUser) {
      return Response.json({ 
        error: 'User with this username or email already exists' 
      }, { 
        status: 409, 
        headers: corsHeaders() 
      });
    }
    
    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();
    
    await env.DB.prepare(`
      INSERT INTO auth_users (username, email, password_hash, date_joined, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).bind(username, email, hashedPassword, now).run();
    
    return Response.json({ 
      detail: 'Registration successful! You can now login.' 
    }, { 
      status: 201, 
      headers: corsHeaders() 
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json({ 
      error: 'Registration failed' 
    }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// POST /api/accounts/login/ - User login
apiRouter.post('/accounts/login/', async (request, env) => {
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }

  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return Response.json({ 
        error: 'Username and password are required' 
      }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Find user by username
    const user = await env.DB.prepare(
      'SELECT id, username, email, password_hash, is_active FROM auth_users WHERE username = ?'
    ).bind(username).first();
    
    if (!user || !user.is_active) {
      return Response.json({ 
        error: 'Invalid credentials' 
      }, { 
        status: 401, 
        headers: corsHeaders() 
      });
    }
    
    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return Response.json({ 
        error: 'Invalid credentials' 
      }, { 
        status: 401, 
        headers: corsHeaders() 
      });
    }
    
    // Generate token
    const access = generateToken(user.username);
    
    return Response.json({ 
      access,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }, { 
      headers: corsHeaders() 
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ 
      error: 'Login failed' 
    }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// GET /api/health - Health check and D1 connectivity test
apiRouter.get('/health', async (request, env) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'unknown',
    version: '1.0.0'
  };

  // Test D1 database connectivity
  if (!env.DB) {
    health.database = 'not_configured';
    health.status = 'degraded';
  } else {
    try {
      // Simple connectivity test
      const result = await env.DB.prepare('SELECT 1 as test').first();
      health.database = result ? 'connected' : 'error';
    } catch (error) {
      health.database = 'error';
      health.error = error.message;
      health.status = 'degraded';
    }
  }

  return Response.json(health, { headers: corsHeaders() });
});

// GET /api/chesscom-app/users/ - List all tracked users
apiRouter.get('/chesscom-app/users/', async (request, env) => {
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  try {
    const users = await db.getUsers();
    return Response.json(users, { headers: corsHeaders() });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Database query failed' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// GET /api/chesscom-app/user/{username}/ - Get specific user details
apiRouter.get('/chesscom-app/user/:username/', async (request, env) => {
  const { username } = request.params;
  
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return Response.json({ error: 'User not found' }, { 
        status: 404, 
        headers: corsHeaders() 
      });
    }
    return Response.json(user, { headers: corsHeaders() });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Database query failed' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// POST /api/chesscom-app/add-user/ - Add user to tracking
apiRouter.post('/chesscom-app/add-user/', async (request, env) => {
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  const chesscomApi = new ChesscomAPI();
  
  try {
    const { username } = await request.json();
    
    if (!username) {
      return Response.json({ error: 'Username is required' }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Validate username with Chess.com API
    const profile = await chesscomApi.fetchChesscomProfile(username);
    if (!profile) {
      return Response.json({ error: 'Invalid Chess.com username' }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Check if user already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return Response.json({ error: 'User already tracked' }, { 
        status: 409, 
        headers: corsHeaders() 
      });
    }
    
    // Add user to database
    const userData = {
      player_id: profile.player_id,
      username: profile.username,
      name: profile.name || profile.username,
      title: profile.title || null,
      followers: profile.followers || 0,
      country: profile.country || null,
      location: profile.location || null,
      joined: profile.joined ? new Date(profile.joined * 1000) : new Date(),
      status: profile.status || 'offline',
      is_playing: false,
      last_online: profile.last_online ? new Date(profile.last_online * 1000) : new Date(),
      avatar: profile.avatar || null
    };
    
    const user = await db.addUser(userData);
    return Response.json(user, { 
      status: 201, 
      headers: corsHeaders() 
    });
  } catch (error) {
    console.error('Error adding user:', error);
    return Response.json({ error: 'Failed to add user' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// DELETE /api/chesscom-app/remove-user/{username}/ - Remove user
apiRouter.delete('/chesscom-app/remove-user/:username/', async (request, env) => {
  const { username } = request.params;
  
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  
  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return Response.json({ error: 'User not found' }, { 
        status: 404, 
        headers: corsHeaders() 
      });
    }
    
    await db.removeUser(username);
    return Response.json({ message: 'User removed successfully' }, { 
      headers: corsHeaders() 
    });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Failed to remove user' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// POST /api/chesscom-app/subscribe/ - Subscribe to email notifications
apiRouter.post('/chesscom-app/subscribe/', async (request, env) => {
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  
  try {
    const { username, email } = await request.json();
    
    if (!username || !email) {
      return Response.json({ error: 'Username and email are required' }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Check if user exists
    const user = await db.getUserByUsername(username);
    if (!user) {
      return Response.json({ error: 'User not found' }, { 
        status: 404, 
        headers: corsHeaders() 
      });
    }
    
    // Check if subscription already exists
    const existingSubscription = await db.getSubscriptionByEmail(user.player_id, email);
    if (existingSubscription && existingSubscription.is_active) {
      return Response.json({ error: 'Subscription already exists' }, { 
        status: 409, 
        headers: corsHeaders() 
      });
    }
    
    // Add or reactivate subscription
    const subscription = await db.addSubscription(user.player_id, email);
    return Response.json(subscription, { 
      status: 201, 
      headers: corsHeaders() 
    });
  } catch (error) {
    console.error('Error subscribing:', error);
    return Response.json({ error: 'Failed to subscribe' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// POST /api/chesscom-app/unsubscribe/ - Unsubscribe from notifications
apiRouter.post('/chesscom-app/unsubscribe/', async (request, env) => {
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  
  try {
    const { username, email } = await request.json();
    
    if (!username || !email) {
      return Response.json({ error: 'Username and email are required' }, { 
        status: 400, 
        headers: corsHeaders() 
      });
    }
    
    // Check if user exists
    const user = await db.getUserByUsername(username);
    if (!user) {
      return Response.json({ error: 'User not found' }, { 
        status: 404, 
        headers: corsHeaders() 
      });
    }
    
    // Remove subscription
    await db.removeSubscription(user.player_id, email);
    return Response.json({ message: 'Unsubscribed successfully' }, { 
      headers: corsHeaders() 
    });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Failed to unsubscribe' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// GET /api/chesscom-app/user/{username}/subscriptions/ - Get user subscriptions
apiRouter.get('/chesscom-app/user/:username/subscriptions/', async (request, env) => {
  const { username } = request.params;
  
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { 
      status: 503, 
      headers: corsHeaders() 
    });
  }
  
  const db = new DatabaseService(env.DB);
  
  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return Response.json({ error: 'User not found' }, { 
        status: 404, 
        headers: corsHeaders() 
      });
    }
    
    const subscriptions = await db.getUserSubscriptions(user.player_id);
    return Response.json(subscriptions, { headers: corsHeaders() });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Failed to fetch subscriptions' }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

export const handleAPI = apiRouter.handle;