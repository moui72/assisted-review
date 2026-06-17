// Tests for submitReview — the function that spawns `gh` to POST a review.
// node:child_process is mocked so no real gh binary is needed.

import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import { submitReview } from '../src/submit';
import type { PrRef, ReviewPayload } from '../src/submit';

const ref: PrRef = { owner: 'alice', repo: 'proj', number: 42 };

const payload = (comments: ReviewPayload['comments'] = []): ReviewPayload => ({
  event: 'COMMENT',
  body: 'summary',
  commit_id: 'headsha',
  comments,
});

type SpawnResponse = { stdout: string; stderr: string; code: number };

// Configure spawn mock so each call gets the next response. Events are
// scheduled via process.nextTick INSIDE the factory (not at setup time)
// so listeners are registered before events fire.
function setupSpawnMock(...responses: SpawnResponse[]) {
  let callIndex = 0;
  vi.mocked(spawn).mockImplementation(() => {
    const r = responses[callIndex++] ?? { stdout: '', stderr: 'no more responses', code: 1 };
    const child = new EventEmitter() as ReturnType<typeof spawn>;
    (child as any).stdout = new EventEmitter();
    (child as any).stderr = new EventEmitter();
    (child as any).stdin = { write: vi.fn(), end: vi.fn() };
    process.nextTick(() => {
      if (r.stdout) (child as any).stdout.emit('data', Buffer.from(r.stdout));
      if (r.stderr) (child as any).stderr.emit('data', Buffer.from(r.stderr));
      child.emit('close', r.code);
    });
    return child;
  });
}

describe('submitReview', () => {
  afterEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('happy path — no inline comments — posts the review and returns html_url', async () => {
    setupSpawnMock({
      stdout: '{"html_url":"https://github.com/alice/proj/pull/42#pullrequestreview-1"}',
      stderr: '',
      code: 0,
    });

    const result = await submitReview(ref, payload());
    expect(result.ok).toBe(true);
    expect(result.html_url).toBe('https://github.com/alice/proj/pull/42#pullrequestreview-1');
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1);
  });

  it('happy path — with inline comments — pre-flights SHA then posts', async () => {
    setupSpawnMock(
      // shaOnPr: SHA is in the commit list
      { stdout: 'headsha\nparentsha\n', stderr: '', code: 0 },
      // POST the review
      { stdout: '{"html_url":"https://github.com/review"}', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ref, payload(comments));
    expect(result.ok).toBe(true);
    expect(result.html_url).toBe('https://github.com/review');
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
  });

  it('stale SHA — pre-flight finds SHA missing — returns stale result without posting', async () => {
    setupSpawnMock(
      // shaOnPr: SHA not in list
      { stdout: 'othersha\n', stderr: '', code: 0 },
      // currentHeadSha: returns the new head
      { stdout: 'newsha\n', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ref, payload(comments));
    expect(result.ok).toBe(false);
    expect(result.stale).toBeDefined();
    expect(result.stale!.old).toBe('headsha');
    expect(result.stale!.new_head).toBe('newsha');
    expect(result.stale!.inline_count).toBe(1);
    // Should not have posted (only 2 gh calls: commits list + head sha)
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
  });

  it('stale SHA — POST returns "Path could not be resolved" — returns stale result', async () => {
    setupSpawnMock(
      // shaOnPr: SHA appears present
      { stdout: 'headsha\n', stderr: '', code: 0 },
      // POST review: returns 422 with stale error message
      { stdout: '', stderr: 'Path could not be resolved', code: 1 },
      // currentHeadSha fallback
      { stdout: 'newsha2\n', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ref, payload(comments));
    expect(result.ok).toBe(false);
    expect(result.stale).toBeDefined();
    expect(result.stale!.new_head).toBe('newsha2');
  });

  it('generic gh failure — returns ok:false with error and payload echoed', async () => {
    setupSpawnMock({ stdout: '', stderr: 'authentication required', code: 1 });

    const result = await submitReview(ref, payload());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('authentication required');
    expect(result.payload).toBeDefined();
  });

  it('gh exits non-zero with no stderr — falls back to exit-code message', async () => {
    setupSpawnMock({ stdout: '', stderr: '', code: 2 });

    const result = await submitReview(ref, payload());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/code 2/);
  });

  it('currentHeadSha gh failure — uses "unknown" as new_head in stale result', async () => {
    setupSpawnMock(
      // shaOnPr: SHA not in list
      { stdout: 'othersha\n', stderr: '', code: 0 },
      // currentHeadSha: fails → falls back to "unknown"
      { stdout: '', stderr: 'forbidden', code: 1 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ref, payload(comments));
    expect(result.ok).toBe(false);
    expect(result.stale!.new_head).toBe('unknown');
  });

  it('close event with null exit code is treated as 0', async () => {
    // Simulate a process whose close event passes null (e.g. killed by signal but
    // we treat it as success for this path; the ?? 0 coalesces null to 0).
    let callIndex = 0;
    const responses = [
      { stdout: '{"html_url":"https://github.com/review"}', stderr: '' as string, code: null as number | null },
    ];
    vi.mocked(spawn).mockImplementation(() => {
      const r = responses[callIndex++];
      const child = new EventEmitter() as ReturnType<typeof spawn>;
      (child as any).stdout = new EventEmitter();
      (child as any).stderr = new EventEmitter();
      (child as any).stdin = { write: vi.fn(), end: vi.fn() };
      process.nextTick(() => {
        if (r.stdout) (child as any).stdout.emit('data', Buffer.from(r.stdout));
        child.emit('close', r.code); // emits null
      });
      return child;
    });

    const result = await submitReview(ref, payload());
    expect(result.ok).toBe(true);
  });

  it('shaOnPr gh failure returns null — does not block submission', async () => {
    setupSpawnMock(
      // shaOnPr: exits non-zero → returns null, submission not blocked
      { stdout: '', stderr: 'forbidden', code: 1 },
      // POST the review succeeds
      { stdout: '{"html_url":"https://github.com/review"}', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ref, payload(comments));
    expect(result.ok).toBe(true);
  });
});
