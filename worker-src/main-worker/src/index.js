import { Router } from 'itty-router';
import { handleStatic } from './handlers/static';
import { handleAPI } from './handlers/api';
import { corsHeaders } from './utils/cors';

const router = Router();

// API routes first to avoid conflicts
router.all('/api/*', handleAPI);

// Serve static React files
router.get('/', handleStatic);
router.get('/assets/*', handleStatic);

// Fallback to React app for SPA routing
router.get('*', handleStatic);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - User-Agent: ${request.headers.get('User-Agent')?.substring(0, 50)}`);
    
    return router.handle(request, env, ctx)
      .then(response => {
        console.log(`[${new Date().toISOString()}] Response: ${response.status} for ${url.pathname}`);
        return response;
      })
      .catch(err => {
        console.error(`[${new Date().toISOString()}] Error handling ${url.pathname}:`, err);
        return new Response('Internal Error', { 
          status: 500,
          headers: corsHeaders(request)
        });
      });
  }
};