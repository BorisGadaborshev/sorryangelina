const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const proxy = createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true
  });
  app.use('/uploads', proxy);
  app.use('/api/uploads', proxy);
};
