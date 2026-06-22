// Tests for the /api/config endpoint — returns preload configuration.

import { get } from 'node:http';
import { startServer } from '../src/server';
import type { AppContext } from '../src/server';

const emptyCtx: AppContext = { review: null, state: null };

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

describe('/api/config', () => {
  it('returns default preload values (chunks=1, overview=true)', async () => {
    const { url } = await startServer(emptyCtx, { port: 0, serveUi: false });
    const cfg = await getJson(`${url}/api/config`) as { preload_chunks: number; preload_overview: boolean };
    expect(cfg.preload_chunks).toBe(1);
    expect(cfg.preload_overview).toBe(true);
  });

  it('reflects custom preloadChunks option', async () => {
    const { url } = await startServer(emptyCtx, { port: 0, serveUi: false, preloadChunks: 3 });
    const cfg = await getJson(`${url}/api/config`) as { preload_chunks: number };
    expect(cfg.preload_chunks).toBe(3);
  });

  it('reflects preloadOverview: false option', async () => {
    const { url } = await startServer(emptyCtx, { port: 0, serveUi: false, preloadOverview: false });
    const cfg = await getJson(`${url}/api/config`) as { preload_overview: boolean };
    expect(cfg.preload_overview).toBe(false);
  });

  it('returns preloadChunks=0 for on-demand-only mode', async () => {
    const { url } = await startServer(emptyCtx, { port: 0, serveUi: false, preloadChunks: 0 });
    const cfg = await getJson(`${url}/api/config`) as { preload_chunks: number; preload_overview: boolean };
    expect(cfg.preload_chunks).toBe(0);
    expect(cfg.preload_overview).toBe(true);
  });
});
