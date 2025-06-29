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
    return router.handle(request, env, ctx)
      .catch(err => new Response('Internal Error', { 
        status: 500,
        headers: corsHeaders(request)
      }));
  }
};