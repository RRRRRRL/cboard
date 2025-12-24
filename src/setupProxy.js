/**
 * Setup Proxy for React Dev Server
 * 
 * This proxy configuration forwards /api requests to the backend server
 * running on port 8000. This allows using relative paths (/api) even when
 * accessing from mobile devices via IP address, without hardcoding URLs.
 * 
 * When accessing from mobile (e.g., http://192.168.62.50:3000):
 * - Frontend uses relative path: /api/profiles
 * - Proxy forwards to: http://localhost:8000/api/profiles
 * - Resources (images) also use relative paths, avoiding hardcoded IPs
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Get backend port from environment or default to 8000
  const backendPort = process.env.REACT_APP_BACKEND_PORT || '8000';
  
  // Determine backend host
  // In development, backend runs on same machine, so use localhost
  // The proxy will forward from the dev server (port 3000) to the backend (port 8000)
  const backendHost = process.env.REACT_APP_BACKEND_HOST || 'localhost';
  const backendUrl = `http://${backendHost}:${backendPort}`;
  
  console.log(`[Proxy] Setting up proxy: /api -> ${backendUrl}`);
  console.log(`[Proxy] This allows using relative paths (/api) without hardcoding ports`);
  console.log(`[Proxy] WebSocket paths (/ws, /sockjs-node) are excluded from proxy`);
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      // Preserve the /api prefix when forwarding
      pathRewrite: {
        '^/api': '/api', // Keep /api in the request
      },
      // Disable WebSocket support in proxy - API doesn't use WebSocket
      // This prevents webpack-dev-server's /ws requests from being proxied
      ws: false,
      // Logging for debugging
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] ${req.method} ${req.url} -> ${backendUrl}${req.url}`);
      },
      onError: (err, req, res) => {
        console.error(`[Proxy] Error proxying ${req.url}:`, err.message);
        if (res && !res.headersSent) {
          res.status(500).json({ error: 'Proxy error', message: err.message });
        }
      },
    })
  );
};

