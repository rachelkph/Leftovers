import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ScanRequest } from '../src/lib/types.ts';
import { ScanError, scanImage } from './scan.ts';

/**
 * POST /api/scan, shared by the local Vite server (server/vitePlugin.ts) and the hosted
 * function (server/vercelScan.ts). The API key stays server-side either way.
 */

const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BODY = 12 * 1024 * 1024;

export interface HandlerOptions {
  /** Called before scanning; throw a ScanError to refuse (e.g. not signed in). */
  authorize?: (req: IncomingMessage) => Promise<void>;
}

export function scanHandler({ authorize }: HandlerOptions = {}) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    try {
      await authorize?.(req);
      const body = parseBody(await readBody(req));
      const result = await scanImage(body);
      send(res, 200, result);
    } catch (error) {
      if (error instanceof ScanError) return send(res, error.status, { error: error.message });
      console.error('[scan]', error);
      send(res, 500, { error: 'Something went wrong reading that image.' });
    }
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new ScanError('That image is too large.', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(raw: string): ScanRequest {
  let body: Partial<ScanRequest>;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ScanError('Invalid request.', 400);
  }
  if ((body.kind !== 'receipt' && body.kind !== 'item') || !body.mediaType || !MEDIA_TYPES.has(body.mediaType) || typeof body.data !== 'string' || !body.data) {
    throw new ScanError('Invalid request.', 400);
  }
  return { kind: body.kind, mediaType: body.mediaType, data: body.data };
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}
