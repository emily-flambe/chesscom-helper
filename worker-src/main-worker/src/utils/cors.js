export function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '*';
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://chesscom-helper.emily-flambe.workers.dev',
    'https://chesscom-helper.com'
  ];
  
  const finalOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': finalOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request)
  });
}