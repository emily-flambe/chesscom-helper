export default {
  async fetch(request: Request): Promise<Response> {
    return new Response('Hello from wrangler v4!', {
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}