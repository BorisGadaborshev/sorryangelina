const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const proxy = createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true
  });
  app.use('/api', proxy);
  app.use('/socket.io', proxy);
  app.use('/uploads', proxy);
};
