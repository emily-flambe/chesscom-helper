import { checkLiveMatches } from './services/match-checker';
import { sendNotifications } from './services/notifications';

export default {
  async scheduled(event, env, ctx) {
    console.log('Cron trigger:', event.cron);
    
    try {
      const notifications = await checkLiveMatches(env);
      await sendNotifications(env, notifications);
      console.log(`Processed ${notifications.length} notifications`);
    } catch (error) {
      console.error('Cron job failed:', error);
      throw error;
    }
  },

  // Allow manual triggering
  async fetch(request, env, ctx) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/trigger') {
      await this.scheduled({ cron: 'manual' }, env, ctx);
      return new Response('Triggered successfully');
    }
    return new Response('Cron Worker Active');
  }
};