import { defineConfig, Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function serveSwitchPolyfillCss(): Plugin {
  const cssPath = path.resolve(__dirname, 'node_modules/input-switch-polyfill/input-switch-polyfill.css');
  return {
    name: 'serve-input-switch-polyfill-css',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].endsWith('/input-switch-polyfill.css') && fs.existsSync(cssPath)) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
          res.end(fs.readFileSync(cssPath, 'utf-8'));
          return;
        }
        next();
      });
    },
    generateBundle() {
      if (fs.existsSync(cssPath)) {
        this.emitFile({
          type: 'asset',
          fileName: 'assets/input-switch-polyfill.css',
          source: fs.readFileSync(cssPath, 'utf-8'),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [serveSwitchPolyfillCss()],
});
