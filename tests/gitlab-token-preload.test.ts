// Regression test: startServer must await the persisted GitLab token load
// before it starts listening.
//
// shouldUseGlab() decides transport by reading gitLabTokenSource(). If the
// server accepts requests while loadGitLabToken() is still in flight, that
// reads `null` and the request routes through glab — silently defeating the
// browser-token precedence, and only in a timing window, which is exactly the
// kind of bug that comes back if nothing pins it down.

import { vi } from 'vitest';

let resolveLoad: () => void;
const loadStarted = vi.fn();

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
  it('does not resolve until the persisted token has loaded', async () => {
    let settled = false;
    const starting = startServer(emptyCtx, { port: 0, serveUi: false }).then((r) => {
      settled = true;
      return r;
    });

    // Give the event loop room to run everything that is not blocked on the
    // preload. If startServer were fire-and-forget, it would have resolved.
    await new Promise((r) => setImmediate(r));
    expect(loadStarted).toHaveBeenCalled();
    expect(settled).toBe(false);

    resolveLoad();
    const { url } = await starting;
    expect(settled).toBe(true);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});
