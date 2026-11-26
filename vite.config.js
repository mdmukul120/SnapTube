import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import channelsHandler from './api/channels.js';
import fixturesHandler from './api/fixtures.js';
import scoresHandler from './api/scores.js';

const apiHandlers = {
  '/channels': channelsHandler,
  '/fixtures': fixturesHandler,
  '/scores': scoresHandler,
};

function installApiMiddleware(server) {
  server.middlewares.use('/api', (req, res, next) => {
    const path = (req.url || '').split('?')[0];
    const handler = apiHandlers[path];
    if (!handler) return next();

    const response = {
      setHeader: (name, value) => res.setHeader(name, value),
      status(code) {
        res.statusCode = code;
        return this;
      },
      json(payload) {
        if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
      },
    };

    Promise.resolve(handler(req, response)).catch(() => {
      server.config.logger.error('[cricfy-local-api] request failed');
      if (res.writableEnded) return;
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'internal_error', items: [] }));
    });
  });
}

function localApiPlugin() {
  return {
    name: 'cricfy-local-api',
    configureServer: installApiMiddleware,
    configurePreviewServer: installApiMiddleware,
  };
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '');
  for (const [name, value] of Object.entries(serverEnv)) {
    if (name.startsWith('CRICFY_') && process.env[name] === undefined) process.env[name] = value;
  }

  return {
    plugins: [react(), localApiPlugin()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
    },
  };
});
