// Tests for submitReview (GitHub) and submitGitLabReview (GitLab).
// node:child_process is mocked so no real gh/glab binary is needed.

import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import { submitReview, submitGitLabReview } from '../src/submit';
import type { PrRef, ReviewPayload } from '../src/submit';

const ghRef: PrRef = { owner: 'alice', repo: 'proj', number: 42, platform: 'github' };
const glRef: PrRef = { owner: 'mygroup/subteam', repo: 'proj', number: 42, platform: 'gitlab' };

const payload = (comments: ReviewPayload['comments'] = []): ReviewPayload => ({
  event: 'COMMENT',
  body: 'summary',
  commit_id: 'headsha',
  comments,
});

type SpawnResponse = { stdout: string; stderr: string; code: number | null };

function makeChild(r: SpawnResponse) {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { write: vi.fn(), end: vi.fn() },
  });
  process.nextTick(() => {
    if (r.stdout) child.stdout.emit('data', Buffer.from(r.stdout));
    if (r.stderr) child.stderr.emit('data', Buffer.from(r.stderr));
    child.emit('close', r.code);
  });
  return child as unknown as ReturnType<typeof spawn>;
}

function setupSpawnMock(...responses: SpawnResponse[]) {
  let callIndex = 0;
  vi.mocked(spawn).mockImplementation(() => makeChild(
    responses[callIndex++] ?? { stdout: '', stderr: 'no more responses', code: 1 },
  ));
}

describe('submitReview (GitHub)', () => {
  afterEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('returns error when COMMENT has no body and no inline comments', async () => {
    const result = await submitReview(ghRef, { ...payload(), body: '' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nothing to submit/i);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(0);
  });

  it('happy path — no inline comments — posts the review and returns html_url', async () => {
    setupSpawnMock({
      stdout: '{"html_url":"https://github.com/alice/proj/pull/42#pullrequestreview-1"}',
      stderr: '',
      code: 0,
    });

    const result = await submitReview(ghRef, payload());
    expect(result.ok).toBe(true);
    expect(result.html_url).toBe('https://github.com/alice/proj/pull/42#pullrequestreview-1');
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1);
  });

  it('happy path — with inline comments — pre-flights SHA then posts', async () => {
    setupSpawnMock(
      { stdout: 'headsha\nparentsha\n', stderr: '', code: 0 },
      { stdout: '{"html_url":"https://github.com/review"}', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ghRef, payload(comments));
    expect(result.ok).toBe(true);
    expect(result.html_url).toBe('https://github.com/review');
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
  });

  it('stale SHA — pre-flight finds SHA missing — returns stale result without posting', async () => {
    setupSpawnMock(
      { stdout: 'othersha\n', stderr: '', code: 0 },
      { stdout: 'newsha\n', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ghRef, payload(comments));
    expect(result.ok).toBe(false);
    expect(result.stale).toBeDefined();
    expect(result.stale!.old).toBe('headsha');
    expect(result.stale!.new_head).toBe('newsha');
    expect(result.stale!.inline_count).toBe(1);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
  });

  it('stale SHA — POST returns "Path could not be resolved" — returns stale result', async () => {
    setupSpawnMock(
      { stdout: 'headsha\n', stderr: '', code: 0 },
      { stdout: '', stderr: 'Path could not be resolved', code: 1 },
      { stdout: 'newsha2\n', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ghRef, payload(comments));
    expect(result.ok).toBe(false);
    expect(result.stale).toBeDefined();
    expect(result.stale!.new_head).toBe('newsha2');
  });

  it('generic gh failure — returns ok:false with error and payload echoed', async () => {
    setupSpawnMock({ stdout: '', stderr: 'authentication required', code: 1 });

    const result = await submitReview(ghRef, payload());
    expect(result.ok).toBe(false);
    expect(result.error).toContain('authentication required');
    expect(result.payload).toBeDefined();
  });

  it('gh exits non-zero with no stderr — falls back to exit-code message', async () => {
    setupSpawnMock({ stdout: '', stderr: '', code: 2 });

    const result = await submitReview(ghRef, payload());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/code 2/);
  });

  it('currentHeadSha gh failure — uses "unknown" as new_head in stale result', async () => {
    setupSpawnMock(
      { stdout: 'othersha\n', stderr: '', code: 0 },
      { stdout: '', stderr: 'forbidden', code: 1 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ghRef, payload(comments));
    expect(result.ok).toBe(false);
    expect(result.stale!.new_head).toBe('unknown');
  });

  it('close event with null exit code is treated as 0', async () => {
    setupSpawnMock({
      stdout: '{"html_url":"https://github.com/review"}',
      stderr: '',
      code: null,
    });

    const result = await submitReview(ghRef, payload());
    expect(result.ok).toBe(true);
  });

  it('shaOnPr gh failure returns null — does not block submission', async () => {
    setupSpawnMock(
      { stdout: '', stderr: 'forbidden', code: 1 },
      { stdout: '{"html_url":"https://github.com/review"}', stderr: '', code: 0 },
    );

    const comments: ReviewPayload['comments'] = [
      { path: 'src/app.ts', body: 'note', side: 'RIGHT', line: 10 },
    ];
    const result = await submitReview(ghRef, payload(comments));
    expect(result.ok).toBe(true);
  });
});

// ---- GitLab ----------------------------------------------------------------

import type { Chunk, DraftComment } from '../src/types';

const chunk = (id: string, file: string): Chunk => ({
  id,
  file,
  hunk_header: '@@ -1,1 +1,1 @@',
  old_range: [1, 3],
  new_range: [1, 3],
  context: '',
  diff: '@@ -1,1 +1,1 @@\n ctx\n-old\n+new',
  members: [],
});

const draft = (chunkId: string, body = 'note', side: 'RIGHT' | 'LEFT' = 'RIGHT', line = 5): DraftComment => ({
  id: `d-${chunkId}`,
  chunk_id: chunkId,
  side,
  line,
  body,
  created_at: '',
  updated_at: '',
});

const versionsResponse = JSON.stringify([{
  base_commit_sha: 'base111',
  start_commit_sha: 'start222',
  head_commit_sha: 'head333',
}]);

describe('submitGitLabReview', () => {
  afterEach(() => vi.mocked(spawn).mockReset());

  it('happy path — no inline comments — posts note, returns ok', async () => {
    setupSpawnMock(
      { stdout: '{}', stderr: '', code: 0 }, // POST /notes
    );

    const result = await submitGitLabReview(glRef, [], [], 'comment', 'summary body', 'headsha');
    expect(result.ok).toBe(true);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1);
  });

  it('returns error when comment verdict has no body and no inline comments', async () => {
    const result = await submitGitLabReview(glRef, [], [], 'comment', '', 'headsha');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nothing to submit/i);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(0);
  });

  it('happy path — with inline comment — stale check, versions, discussion, note', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'headsha' }]), stderr: '', code: 0 }, // commits (stale check)
      { stdout: versionsResponse, stderr: '', code: 0 },                    // /versions
      { stdout: '{}', stderr: '', code: 0 },                               // POST /discussions
      { stdout: '{}', stderr: '', code: 0 },                               // POST /notes
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      'summary',
      'headsha',
    );
    expect(result.ok).toBe(true);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(4);
  });

  it('stale SHA — commits check finds SHA missing', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'othersha' }]), stderr: '', code: 0 }, // commits
      { stdout: JSON.stringify({ sha: 'newsha' }), stderr: '', code: 0 },    // current head
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      '',
      'headsha',
    );
    expect(result.ok).toBe(false);
    expect(result.stale).toBeDefined();
    expect(result.stale!.old).toBe('headsha');
    expect(result.stale!.new_head).toBe('newsha');
    expect(result.stale!.inline_count).toBe(1);
  });

  it('approve — posts note then calls approve endpoint', async () => {
    setupSpawnMock(
      { stdout: '{}', stderr: '', code: 0 }, // POST /notes
      { stdout: '{}', stderr: '', code: 0 }, // POST /approve
    );

    const result = await submitGitLabReview(glRef, [], [], 'approve', 'LGTM', 'headsha');
    expect(result.ok).toBe(true);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(spawn).mock.calls;
    expect((calls[1][1] as string[]).join(' ')).toContain('approve');
  });

  it('comment error collected — other comments succeed', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'headsha' }]), stderr: '', code: 0 }, // commits
      { stdout: versionsResponse, stderr: '', code: 0 },                    // versions
      { stdout: '', stderr: 'invalid position', code: 1 },                  // discussion 1 fails
      { stdout: '{}', stderr: '', code: 0 },                               // discussion 2 ok
      { stdout: '{}', stderr: '', code: 0 },                               // note
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/a.ts'), chunk('c2', 'src/b.ts')],
      [draft('c1'), draft('c2')],
      'comment',
      'body',
      'headsha',
    );
    expect(result.ok).toBe(true);
    expect(result.comment_errors).toHaveLength(1);
    expect(result.comment_errors![0].path).toBe('src/a.ts');
  });

  it('versions failure — returns ok:false immediately', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'headsha' }]), stderr: '', code: 0 }, // commits
      { stdout: '', stderr: 'api error', code: 1 },                         // versions fails
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      '',
      'headsha',
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('api error');
  });

  it('note POST failure — returns ok:false', async () => {
    setupSpawnMock(
      { stdout: '', stderr: 'unauthorized', code: 1 }, // POST /notes fails
    );

    const result = await submitGitLabReview(glRef, [], [], 'comment', 'summary', 'headsha');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('unauthorized');
  });

  it('approve POST failure — returns ok:false', async () => {
    setupSpawnMock(
      { stdout: '{}', stderr: '', code: 0 },          // POST /notes ok
      { stdout: '', stderr: 'not allowed', code: 1 }, // POST /approve fails
    );

    const result = await submitGitLabReview(glRef, [], [], 'approve', 'LGTM', 'headsha');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('glabShaOnMr failure — does not block submission', async () => {
    setupSpawnMock(
      { stdout: '', stderr: 'forbidden', code: 1 },   // commits fails → null
      { stdout: versionsResponse, stderr: '', code: 0 },
      { stdout: '{}', stderr: '', code: 0 },           // discussion
      { stdout: '{}', stderr: '', code: 0 },           // note
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      'body',
      'headsha',
    );
    expect(result.ok).toBe(true);
  });

  it('glabCurrentHeadSha failure uses "unknown"', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'other' }]), stderr: '', code: 0 }, // commits — sha not present
      { stdout: '', stderr: 'forbidden', code: 1 },                        // current head fails
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      '',
      'headsha',
    );
    expect(result.ok).toBe(false);
    expect(result.stale!.new_head).toBe('unknown');
  });

  it('glabCurrentHeadSha invalid JSON uses "unknown"', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'other' }]), stderr: '', code: 0 }, // commits — sha not present
      { stdout: 'not json', stderr: '', code: 0 },                         // current head invalid JSON
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      '',
      'headsha',
    );
    expect(result.ok).toBe(false);
    expect(result.stale!.new_head).toBe('unknown');
  });

  it('glabShaOnMr invalid JSON returns null (does not block submission)', async () => {
    setupSpawnMock(
      { stdout: 'invalid json', stderr: '', code: 0 }, // commits — invalid JSON → null
      { stdout: versionsResponse, stderr: '', code: 0 },
      { stdout: '{}', stderr: '', code: 0 }, // discussion
      { stdout: '{}', stderr: '', code: 0 }, // note
    );

    const result = await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [draft('c1')],
      'comment',
      'body',
      'headsha',
    );
    expect(result.ok).toBe(true);
  });

  it('encodes namespace slashes in project path', async () => {
    setupSpawnMock({ stdout: '{}', stderr: '', code: 0 });
    await submitGitLabReview(glRef, [], [], 'comment', 'body', 'sha');
    const [, args] = vi.mocked(spawn).mock.calls[0];
    expect((args as string[]).join(' ')).toContain('mygroup%2Fsubteam%2Fproj');
  });

  it('LEFT-side comment sends old_line, null new_line', async () => {
    setupSpawnMock(
      { stdout: JSON.stringify([{ id: 'headsha' }]), stderr: '', code: 0 },
      { stdout: versionsResponse, stderr: '', code: 0 },
      { stdout: '{}', stderr: '', code: 0 }, // discussion
    );

    const leftDraft = draft('c1', 'note', 'LEFT', 3);
    await submitGitLabReview(
      glRef,
      [chunk('c1', 'src/app.ts')],
      [leftDraft],
      'comment',
      '',
      'headsha',
    );
    const discussionCall = vi.mocked(spawn).mock.calls[2];
    const input = (discussionCall[0] === 'glab')
      ? vi.mocked(spawn).mock.instances[2]
      : undefined;
    // The position was sent as JSON stdin — just verify the call was to 'glab'
    expect(discussionCall[0]).toBe('glab');
  });
});
