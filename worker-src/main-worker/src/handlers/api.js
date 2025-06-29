import { Router } from 'itty-router';
import { DatabaseService } from '../services/database';
import { ChesscomAPI } from '../services/chesscom-api';
import { corsHeaders } from '../utils/cors';

const apiRouter = Router({ base: '/api' });

// CORS preflight handler
apiRouter.options('*', () => new Response(null, { 
  status: 204, 
  headers: corsHeaders() 
}));

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