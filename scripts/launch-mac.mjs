// The server owns its listening socket. Chrome may hand a launch to an
// existing profile and exit immediately, so browser process IDs cannot tell
// us whether the simulator is still open.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const logDir = join(homedir(), 'Library', 'Logs', 'DLR Signalling Sim');
mkdirSync(logDir, { recursive: true });
const log = message => appendFileSync(join(logDir, 'launcher.log'), new Date().toISOString() + ' ' + message + '\n');
let server;
let timer;

async function close() {
  clearInterval(timer);
  await server?.close();
}

try {
  const { createServer } = await import('vite');
  const session = randomUUID();
  server = await createServer({
    server: { host: '127.0.0.1', port: 5173, strictPort: false, open: false },
    plugins: [{
      name: 'dlr-launcher-status',
      configureServer(vite) {
        vite.middlewares.use('/__dlr/status', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ application: 'DLR Signalling Sim', session, pid: process.pid }));
        });
      },
    }],
  });
  await server.listen();
  const url = 'http://127.0.0.1:' + server.httpServer.address().port;
  const status = await fetch(url + '/__dlr/status', { signal: AbortSignal.timeout(5000) });
  if (!status.ok || (await status.json()).session !== session) throw new Error('Could not verify the local simulator.');
  log('Ready ' + url + '/ (pid ' + process.pid + ')');

  const browsers = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  const browser = browsers.find(existsSync);
  const child = browser
    ? spawn(browser, ['--app=' + url, '--user-data-dir=/tmp/dlr-signalling-sim-chrome-profile', '--window-size=1640,980', '--no-first-run'], { detached: true, stdio: 'ignore' })
    : spawn('/usr/bin/open', [url], { stdio: 'ignore' });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();

  let lastClient = Date.now();
  let connected = false;
  timer = setInterval(() => {
    if (server.ws.clients.size) {
      connected = true;
      lastClient = Date.now();
    } else if (Date.now() - lastClient > (connected ? 15000 : 90000)) {
      log('Closed ' + url + (connected ? ' after the last window disconnected' : ' after waiting for a browser'));
      void close();
    }
  }, 1000);
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
} catch (error) {
  log('Launch failed: ' + error.message);
  await close();
  spawn('/usr/bin/osascript', ['-e', 'display alert "DLR Signalling Sim" message "Could not start the simulator. See ~/Library/Logs/DLR Signalling Sim/launcher.log for details."']);
  process.exitCode = 1;
}
