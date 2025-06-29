export async function handleStatic(request, env) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Default to index.html for SPA routing
  if (pathname === '/' || !pathname.includes('.')) {
    pathname = '/index.html';
  }

  // Remove leading slash for asset lookup
  const assetKey = pathname.replace(/^\//, '');
  
  // Get asset from Worker's bundled assets
  const asset = await env.ASSETS.fetch(`https://placeholder.com/${assetKey}`);
  
  if (asset.status === 404) {
    // Fallback to index.html for SPA routing
    return await env.ASSETS.fetch('https://placeholder.com/index.html');
  }

  return asset;
}