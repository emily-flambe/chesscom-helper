export async function handleStatic(request, env) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Default to index.html for SPA routing
  if (pathname === '/' || !pathname.includes('.')) {
    pathname = '/index.html';
  }

  try {
    // Remove leading slash for asset lookup
    const assetKey = pathname.replace(/^\//, '');
    
    // Get asset from the ASSETS binding
    const asset = await env.ASSETS.fetch(new Request(`https://assets/${assetKey}`));
    
    if (asset.status === 200) {
      const headers = new Headers(asset.headers);
      
      // Set proper content types
      if (pathname.endsWith('.html')) {
        headers.set('Content-Type', 'text/html');
      } else if (pathname.endsWith('.js')) {
        headers.set('Content-Type', 'application/javascript');
      } else if (pathname.endsWith('.css')) {
        headers.set('Content-Type', 'text/css');
      } else if (pathname.endsWith('.png')) {
        headers.set('Content-Type', 'image/png');
      } else if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
        headers.set('Content-Type', 'image/jpeg');
      }
      
      return new Response(asset.body, { headers });
    }
    
    // Fallback to index.html for SPA routing
    if (pathname !== '/index.html') {
      const indexAsset = await env.ASSETS.fetch(new Request('https://assets/index.html'));
      if (indexAsset.status === 200) {
        return new Response(indexAsset.body, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
    
  } catch (error) {
    console.error('Static handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}