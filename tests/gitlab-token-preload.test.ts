// Regression test: startServer must await the persisted GitLab token load
// before it starts listening.
//
// shouldUseGlab() decides transport by reading gitLabTokenSource(). If the
// server accepts requests while loadGitLabToken() is still in flight, that
// reads `null` and the request routes through glab — silently defeating the
// browser-token precedence, and only in a timing window, which is exactly the
// kind of bug that comes back if nothing pins it down.
//
// node:http is mocked so no real socket is opened: startServer returns only
// `{ url }` with no close handle, so a real listener would leak an open handle
// into the worker. Mocking also lets this assert the actual invariant —
// `listen` is not reached until the preload resolves — rather than the weaker
// proxy of when the returned promise settles.

import { vi } from 'vitest';

let resolveLoad: () => void;
const loadStarted = vi.fn();
const listen = vi.fn();

vi.mock('node:http', () => ({
  createServer: vi.fn(() => ({
    on: vi.fn(),
    listen: listen.mockImplementation((_port: number, _host: string, cb: () => void) => {
      process.nextTick(cb);
    }),
    address: () => ({ port: 4319 }),
  })),
}));

vi.mock('../src/gitlab-token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/gitlab-token')>();
  return {
    ...actual,
    loadGitLabToken: vi.fn(() => {
      loadStarted();
      return new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
    }),
  };
});

import { startServer } from '../src/server';
import type { AppContext } from '../src/server';

const emptyCtx: AppContext = { review: null, state: null };

describe('startServer — GitLab token preload', () => {
  it('does not listen until the persisted token has loaded', async () => {
    const starting = startServer(emptyCtx, { port: 0, serveUi: false });

    // Give the event loop room to run everything not blocked on the preload.
    // Were the load fire-and-forget, listen() would already have been called.
    await new Promise((r) => setImmediate(r));
    expect(loadStarted).toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();

    resolveLoad();
    const { url } = await starting;
    expect(listen).toHaveBeenCalledTimes(1);
    expect(url).toBe('http://127.0.0.1:4319');
  });
});
