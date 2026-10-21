import type { Plugin } from 'vite';
import { scanHandler } from './handler.ts';
import { activeScanner } from './scan.ts';

/** Mounts POST /api/scan on the Vite dev and preview servers, keeping the API key server-side. */
export function scanApi(): Plugin {
  // Local only, so no sign-in check here; the hosted function (server/vercelScan.ts) requires one.
  const handler = scanHandler();
  return {
    name: 'leftovers-scan-api',
    configureServer(server) {
      server.middlewares.use('/api/scan', handler);
      server.httpServer?.once('listening', async () => {
        const messages = {
          api: '  ✓ Scanning is on — using your Anthropic API key (.env)',
          'claude-code': '  ✓ Scanning is on — using Claude Code on your Claude subscription (local only)',
          none: '  ! Scanning is off — run `npm run setup` for options. Adding by hand still works.',
        };
        const status = messages[await activeScanner()];
        setTimeout(() => server.config.logger.info(status), 50);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/scan', handler);
    },
  };
}
