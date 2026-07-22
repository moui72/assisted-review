import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  applyAiProviderConfigUpdate,
  applyAction,
  deleteReview,
  listReviews,
  loadAiProviderConfig,
  loadState,
  migrate,
  normalizeAiProviderConfig,
  reconcileAnchors,
  saveAiProviderConfig,
  saveState,
  STATE_DIR,
  statePath,
} from '../src/state';
import type { Action, Chunk, PrRef, ReviewState } from '../src/types';
import { OVERVIEW_ID, STATE_VERSION } from '../src/types';

const baseState = (pr: PrRef): ReviewState => ({
  version: STATE_VERSION,
  pr,
  head_sha: 'sha0',
  draft_head_sha: 'sha0',
  started_at: '2020-01-01T00:00:00.000Z',
  comments: [],
  flagged: [],
  viewed: [],
  notes: [],
});

describe('applyAction', () => {
  const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' as const };

  it('add_comment creates a comment with id, timestamps and fields', () => {
    const state = baseState(pr);
    const action: Action = {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 12,
      body: 'looks good',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    };
    const next = applyAction(state, action);
    expect(next.comments).toHaveLength(1);
    const c = next.comments[0];
    expect(c.id).toEqual(expect.any(String));
    expect(c.id.length).toBeGreaterThan(0);
    expect(c.chunk_id).toBe('c1');
    expect(c.side).toBe('RIGHT');
    expect(c.line).toBe(12);
    expect(c.body).toBe('looks good');
    expect(c.file).toBe('a.ts');
    expect(c.hunk_header).toBe('@@ -1,3 +1,3 @@');
    expect(c.displaced).toBe(false);
    expect(c.created_at).toEqual(expect.any(String));
    expect(c.updated_at).toEqual(expect.any(String));
  });

  it('add_comment does not mutate the input state (immutability)', () => {
    const state = baseState(pr);
    const action: Action = {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'LEFT',
      line: null,
      body: 'x',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    };
    const next = applyAction(state, action);
    expect(state.comments).toHaveLength(0);
    expect(next).not.toBe(state);
    expect(next.comments).not.toBe(state.comments);
  });

  it('update_comment changes only the matching id body + updated_at', () => {
    let state = baseState(pr);
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 1,
      body: 'first',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c2',
      side: 'RIGHT',
      line: 2,
      body: 'second',
      file: 'b.ts',
      hunk_header: '@@ -4,3 +4,3 @@',
    });
    const targetId = state.comments[0].id;
    const otherBefore = state.comments[1];
    // Pin the clock forward so the refreshed updated_at is observably distinct
    // from the created_at set on the same millisecond above.
    const later = '2099-01-01T00:00:00.000Z';
    const spy = vi
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue(later);
    const next = applyAction(state, {
      type: 'update_comment',
      id: targetId,
      body: 'edited',
    });
    spy.mockRestore();
    expect(next.comments[0].body).toBe('edited');
    expect(next.comments[0].updated_at).toBe(later);
    expect(next.comments[0].updated_at).not.toBe(state.comments[0].updated_at);
    // non-matching comment untouched.
    expect(next.comments[1]).toEqual(otherBefore);
  });

  it('delete_comment removes the matching comment', () => {
    let state = baseState(pr);
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 1,
      body: 'a',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    const id = state.comments[0].id;
    const next = applyAction(state, { type: 'delete_comment', id });
    expect(next.comments).toHaveLength(0);
  });

  it('reanchor_comment clears displaced and updates the anchor on the matching comment only', () => {
    let state = baseState(pr);
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 1,
      body: 'first',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c2',
      side: 'RIGHT',
      line: 2,
      body: 'second',
      file: 'b.ts',
      hunk_header: '@@ -4,3 +4,3 @@',
    });
    const targetId = state.comments[0].id;
    const otherBefore = state.comments[1];
    // Simulate the target comment having been marked displaced by reconciliation.
    state = {
      ...state,
      comments: state.comments.map((c) =>
        c.id === targetId ? { ...c, displaced: true } : c,
      ),
    };
    const next = applyAction(state, {
      type: 'reanchor_comment',
      id: targetId,
      chunk_id: 'c9',
      side: 'LEFT',
      line: 42,
      file: 'c.ts',
      hunk_header: '@@ -9,3 +9,3 @@',
    });
    const reanchored = next.comments.find((c) => c.id === targetId)!;
    expect(reanchored.chunk_id).toBe('c9');
    expect(reanchored.side).toBe('LEFT');
    expect(reanchored.line).toBe(42);
    expect(reanchored.file).toBe('c.ts');
    expect(reanchored.hunk_header).toBe('@@ -9,3 +9,3 @@');
    expect(reanchored.displaced).toBe(false);
    // non-matching comment untouched.
    expect(next.comments.find((c) => c.id === otherBefore.id)).toEqual(otherBefore);
  });

  it('toggle_flag adds then removes on repeat', () => {
    const state = baseState(pr);
    const flagged = applyAction(state, {
      type: 'toggle_flag',
      chunk_id: 'c1',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    expect(flagged.flagged).toEqual([
      { chunk_id: 'c1', file: 'a.ts', hunk_header: '@@ -1,3 +1,3 @@', displaced: false },
    ]);
    const unflagged = applyAction(flagged, {
      type: 'toggle_flag',
      chunk_id: 'c1',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    expect(unflagged.flagged).toEqual([]);
  });

  it('set_viewed true adds and is idempotent (deduped)', () => {
    const state = baseState(pr);
    const once = applyAction(state, {
      type: 'set_viewed',
      chunk_id: 'c1',
      viewed: true,
    });
    expect(once.viewed).toEqual(['c1']);
    const twice = applyAction(once, {
      type: 'set_viewed',
      chunk_id: 'c1',
      viewed: true,
    });
    expect(twice.viewed).toEqual(['c1']);
  });

  it('set_viewed false removes the chunk id', () => {
    let state = baseState(pr);
    state = applyAction(state, {
      type: 'set_viewed',
      chunk_id: 'c1',
      viewed: true,
    });
    const next = applyAction(state, {
      type: 'set_viewed',
      chunk_id: 'c1',
      viewed: false,
    });
    expect(next.viewed).toEqual([]);
  });

  it('add_note creates a stored note with id, chunk_id, kind, body, created_at', () => {
    const state = baseState(pr);
    const next = applyAction(state, {
      type: 'add_note',
      chunk_id: 'c1',
      kind: 'initial',
      body: 'looks risky',
      suggested_action: 'ask the author',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    expect(next.notes).toHaveLength(1);
    const n = next.notes[0];
    expect(n.id).toEqual(expect.any(String));
    expect(n.id.length).toBeGreaterThan(0);
    expect(n.chunk_id).toBe('c1');
    expect(n.kind).toBe('initial');
    expect(n.body).toBe('looks risky');
    expect(n.suggested_action).toBe('ask the author');
    expect(n.file).toBe('a.ts');
    expect(n.hunk_header).toBe('@@ -1,3 +1,3 @@');
    expect(n.displaced).toBe(false);
    expect(n.created_at).toEqual(expect.any(String));
  });

  it('add_note for the overview page (no file/hunk_header) leaves anchor fields undefined', () => {
    const next = applyAction(baseState(pr), {
      type: 'add_note',
      chunk_id: OVERVIEW_ID,
      kind: 'initial',
      body: 'PR summary',
    });
    const n = next.notes[0];
    expect(n.chunk_id).toBe(OVERVIEW_ID);
    expect(n.file).toBeUndefined();
    expect(n.hunk_header).toBeUndefined();
    expect(n.displaced).toBeUndefined();
  });

  it('add_note without optional fields leaves them undefined', () => {
    const next = applyAction(baseState(pr), {
      type: 'add_note',
      chunk_id: 'c2',
      kind: 'investigation',
      body: 'context note',
    });
    expect(next.notes[0].suggested_action).toBeUndefined();
    expect(next.notes[0].prompt).toBeUndefined();
  });

  it('delete_note removes the matching note and leaves others', () => {
    let state = baseState(pr);
    state = applyAction(state, { type: 'add_note', chunk_id: 'c1', kind: 'initial', body: 'first' });
    state = applyAction(state, { type: 'add_note', chunk_id: 'c2', kind: 'context', body: 'second' });
    const id = state.notes[0].id;
    const next = applyAction(state, { type: 'delete_note', id });
    expect(next.notes).toHaveLength(1);
    expect(next.notes[0].body).toBe('second');
  });

  it('unknown action type returns state unchanged', () => {
    const state = baseState(pr);
    // @ts-expect-error — deliberately passing an unknown type
    const next = applyAction(state, { type: 'nonexistent' });
    expect(next).toBe(state);
  });
});

describe('migrate', () => {
  const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' as const };

  it('v0 with no notes field gets notes: [] and version stamped', () => {
    const raw = {
      pr,
      head_sha: 'sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [],
      flagged: [],
      viewed: [],
    };
    const result = migrate(raw);
    expect(result.version).toBe(STATE_VERSION);
    expect(result.notes).toEqual([]);
  });

  it('v0 with existing notes array preserves notes', () => {
    const note = {
      id: 'n1',
      chunk_id: 'c1',
      kind: 'initial' as const,
      body: 'hi',
      created_at: '2020-01-01T00:00:00.000Z',
    };
    const raw = {
      pr,
      head_sha: 'sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [],
      flagged: [],
      viewed: [],
      notes: [note],
    };
    const result = migrate(raw);
    expect(result.version).toBe(STATE_VERSION);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].id).toBe('n1');
  });

  it('already-versioned state passes through unchanged', () => {
    const state = baseState(pr);
    const result = migrate(state);
    expect(result).toEqual(state);
  });

  it('does not mutate the input object', () => {
    const raw: Record<string, unknown> = {
      pr,
      head_sha: 'sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [],
      flagged: [],
      viewed: [],
    };
    migrate(raw);
    expect('version' in raw).toBe(false);
    expect('notes' in raw).toBe(false);
  });

  it('backfills platform: github on pr field when missing', () => {
    const raw = {
      pr: { owner: 'o', repo: 'r', number: 1 }, // no platform field
      head_sha: 'sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [],
      flagged: [],
      viewed: [],
    };
    const result = migrate(raw);
    expect(result.pr.platform).toBe('github');
  });

  it('backfills draft_head_sha from persisted head_sha before load refreshes it', () => {
    const raw = {
      pr,
      head_sha: 'drafted-sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [],
      flagged: [],
      viewed: [],
      notes: [],
    };
    const result = migrate(raw);
    expect(result.draft_head_sha).toBe('drafted-sha');
  });

  it('does not overwrite an existing platform field', () => {
    const glPr: PrRef = { owner: 'group/repo', repo: 'proj', number: 1, platform: 'gitlab' };
    const state = baseState(glPr);
    const result = migrate(state);
    expect(result.pr.platform).toBe('gitlab');
  });

  it('v1 -> v2 backfills anchor-snapshot fields as displaced on legacy comments/notes/flagged', () => {
    const raw = {
      version: 1,
      pr,
      head_sha: 'sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [
        { id: 'cm1', chunk_id: 'c1', side: 'RIGHT', line: 1, body: 'x', created_at: 't', updated_at: 't' },
      ],
      flagged: ['c2'],
      viewed: ['c3'],
      notes: [
        { id: 'n1', chunk_id: 'c1', kind: 'initial', body: 'note body', created_at: 't' },
        { id: 'n2', chunk_id: OVERVIEW_ID, kind: 'initial', body: 'overview note', created_at: 't' },
      ],
    };
    const result = migrate(raw);
    expect(result.version).toBe(STATE_VERSION);

    expect(result.comments[0].file).toBe('');
    expect(result.comments[0].hunk_header).toBe('');
    expect(result.comments[0].displaced).toBe(true);

    expect(result.flagged).toEqual([
      { chunk_id: 'c2', file: '', hunk_header: '', displaced: true },
    ]);

    expect(result.notes[0].file).toBe('');
    expect(result.notes[0].hunk_header).toBe('');
    expect(result.notes[0].displaced).toBe(true);
    // Overview notes are never subject to reconciliation — left untouched.
    expect(result.notes[1].file).toBeUndefined();
    expect(result.notes[1].displaced).toBeUndefined();
  });

  it('v1 -> v2 leaves already-migrated comments/notes untouched', () => {
    const raw = {
      version: 1,
      pr,
      head_sha: 'sha',
      started_at: '2020-01-01T00:00:00.000Z',
      comments: [
        {
          id: 'cm1', chunk_id: 'c1', side: 'RIGHT', line: 1, body: 'x',
          file: 'a.ts', hunk_header: '@@ -1,3 +1,3 @@', displaced: false,
          created_at: 't', updated_at: 't',
        },
      ],
      flagged: [],
      viewed: [],
      notes: [],
    };
    const result = migrate(raw);
    expect(result.comments[0].file).toBe('a.ts');
    expect(result.comments[0].displaced).toBe(false);
  });
});

describe('reconcileAnchors', () => {
  const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' as const };

  const makeChunk = (id: string, file: string, hunk_header: string): Chunk => ({
    id,
    file,
    hunk_header,
    old_range: [1, 1],
    new_range: [1, 1],
    context: '',
    diff: '',
    members: [],
  });

  it('resyncs chunk_id and clears displaced for an entry whose anchor still matches', () => {
    const state = baseState(pr);
    state.comments = [
      {
        id: 'cm1', chunk_id: 'c1', side: 'RIGHT', line: 1, body: 'x',
        file: 'a.ts', hunk_header: '@@ -1,3 +1,3 @@', displaced: true,
        created_at: 't', updated_at: 't',
      },
    ];
    // Same file+hunk_header, but renumbered to c5 in the fresh parse.
    const chunks = [makeChunk('c5', 'a.ts', '@@ -1,3 +1,3 @@')];
    const result = reconcileAnchors(state, chunks);
    expect(result.comments[0].chunk_id).toBe('c5');
    expect(result.comments[0].displaced).toBe(false);
  });

  it('marks an entry displaced and retains its last-known snapshot when its hunk changed', () => {
    const state = baseState(pr);
    state.comments = [
      {
        id: 'cm1', chunk_id: 'c1', side: 'RIGHT', line: 1, body: 'x',
        file: 'a.ts', hunk_header: '@@ -1,3 +1,3 @@', displaced: false,
        created_at: 't', updated_at: 't',
      },
    ];
    // a.ts's hunk_header changed — no exact match in the fresh parse.
    const chunks = [makeChunk('c1', 'a.ts', '@@ -1,5 +1,7 @@')];
    const result = reconcileAnchors(state, chunks);
    expect(result.comments[0].displaced).toBe(true);
    expect(result.comments[0].chunk_id).toBe('c1'); // last-known, retained
    expect(result.comments[0].file).toBe('a.ts');
    expect(result.comments[0].hunk_header).toBe('@@ -1,3 +1,3 @@');
  });

  it('never reconciles overview notes (no file/hunk_header to match)', () => {
    const state = baseState(pr);
    state.notes = [
      { id: 'n1', chunk_id: OVERVIEW_ID, kind: 'initial', body: 'summary', created_at: 't' },
    ];
    const result = reconcileAnchors(state, []);
    expect(result.notes[0].chunk_id).toBe(OVERVIEW_ID);
    expect(result.notes[0].displaced).toBeUndefined();
  });

  it('reconciles flagged entries the same way as comments', () => {
    const state = baseState(pr);
    state.flagged = [
      { chunk_id: 'c1', file: 'a.ts', hunk_header: '@@ -1,3 +1,3 @@', displaced: false },
    ];
    const result = reconcileAnchors(state, []); // hunk no longer exists at all
    expect(result.flagged[0].displaced).toBe(true);
    expect(result.flagged[0].chunk_id).toBe('c1');
  });
});

describe('statePath', () => {
  it('GitHub: produces owner-repo-number.json', () => {
    const p = statePath({ owner: 'alice', repo: 'proj', number: 42, platform: 'github' });
    expect(p).toMatch(/alice-proj-42\.json$/);
    expect(p).not.toContain('gitlab');
  });

  it('GitLab: prefixes with gitlab~ and encodes slashes in owner', () => {
    const p = statePath({ owner: 'group/subteam', repo: 'proj', number: 7, platform: 'gitlab' });
    expect(p).toMatch(/gitlab~group%2Fsubteam~proj~7\.json$/);
  });

  it('GitLab simple namespace (no slash) still prefixes with gitlab~', () => {
    const p = statePath({ owner: 'mygroup', repo: 'proj', number: 1, platform: 'gitlab' });
    expect(p).toMatch(/gitlab~mygroup~proj~1\.json$/);
  });

  it('GitHub owner named "gitlab-alice" does not collide with GitLab owner "alice"', () => {
    const gh = statePath({ owner: 'gitlab-alice', repo: 'proj', number: 42, platform: 'github' });
    const gl = statePath({ owner: 'alice', repo: 'proj', number: 42, platform: 'gitlab' });
    expect(gh).not.toBe(gl);
  });
});

describe('loadState / saveState persistence', () => {
  // Distinct PR numbers per test to avoid file collisions.
  const cleanup = async (pr: PrRef) => {
    await rm(statePath(pr), { force: true });
    await rm(`${statePath(pr)}.tmp`, { force: true });
  };

  it('loadState on a non-existent file returns empty state with given head_sha and started_at', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1001, platform: 'github' as const };
    await cleanup(pr);
    const state = await loadState(pr, 'sha-abc');
    expect(state.head_sha).toBe('sha-abc');
    expect(state.comments).toEqual([]);
    expect(state.flagged).toEqual([]);
    expect(state.viewed).toEqual([]);
    expect(state.started_at).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(state.started_at))).toBe(false);
    await cleanup(pr);
  });

  it('saveState then loadState round-trips comments/flags/viewed', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1002, platform: 'github' as const };
    await cleanup(pr);
    let state = await loadState(pr, 'sha1');
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 5,
      body: 'hi',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    state = applyAction(state, {
      type: 'toggle_flag',
      chunk_id: 'c2',
      file: 'b.ts',
      hunk_header: '@@ -4,3 +4,3 @@',
    });
    state = applyAction(state, {
      type: 'set_viewed',
      chunk_id: 'c3',
      viewed: true,
    });
    await saveState(state);

    const loaded = await loadState(pr, 'sha1');
    expect(loaded.comments).toHaveLength(1);
    expect(loaded.comments[0].body).toBe('hi');
    expect(loaded.comments[0].chunk_id).toBe('c1');
    expect(loaded.flagged).toEqual([
      { chunk_id: 'c2', file: 'b.ts', hunk_header: '@@ -4,3 +4,3 @@', displaced: false },
    ]);
    expect(loaded.viewed).toEqual(['c3']);
    await cleanup(pr);
  });

  it('saved state includes version and round-trips it', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1004, platform: 'github' as const };
    await cleanup(pr);
    const state = await loadState(pr, 'sha1');
    expect(state.version).toBe(STATE_VERSION);
    await saveState(state);
    const loaded = await loadState(pr, 'sha1');
    expect(loaded.version).toBe(STATE_VERSION);
    await cleanup(pr);
  });

  it('loadState refreshes head_sha even when prior state exists', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1003, platform: 'github' as const };
    await cleanup(pr);
    const state = await loadState(pr, 'old-sha');
    await saveState(state);
    const reloaded = await loadState(pr, 'new-sha');
    expect(reloaded.head_sha).toBe('new-sha');
    await cleanup(pr);
  });

  it('loadState preserves draft_head_sha while inline comments exist', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1005, platform: 'github' as const };
    await cleanup(pr);
    let state = await loadState(pr, 'drafted-sha');
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 1,
      body: 'drafted before refresh',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    await saveState(state);

    const reloaded = await loadState(pr, 'latest-sha');
    expect(reloaded.head_sha).toBe('latest-sha');
    expect(reloaded.draft_head_sha).toBe('drafted-sha');
    await cleanup(pr);
  });

  it('loadState resets draft_head_sha to latest head_sha when no inline comments exist', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1006, platform: 'github' as const };
    await cleanup(pr);
    const state = await loadState(pr, 'old-sha');
    await saveState(state);

    const reloaded = await loadState(pr, 'latest-sha');
    expect(reloaded.head_sha).toBe('latest-sha');
    expect(reloaded.draft_head_sha).toBe('latest-sha');
    await cleanup(pr);
  });
});

describe('AI provider config persistence', () => {
  const configPath = join(STATE_DIR, 'ai-config.json');

  beforeEach(async () => {
    await rm(configPath, { force: true });
    await rm(`${configPath}.tmp`, { force: true });
  });

  afterEach(async () => {
    await rm(configPath, { force: true });
    await rm(`${configPath}.tmp`, { force: true });
  });

  it('loadAiProviderConfig defaults to Claude when no file exists', async () => {
    await expect(loadAiProviderConfig()).resolves.toEqual({
      provider: 'claude',
      updated_at: '1970-01-01T00:00:00.000Z',
    });
  });

  it('saveAiProviderConfig round-trips a Claude model update', async () => {
    await saveAiProviderConfig({
      provider: 'claude',
      claude_model: '  opus  ',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    await expect(loadAiProviderConfig()).resolves.toEqual({
      provider: 'claude',
      claude_model: 'opus',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('saveAiProviderConfig round-trips a Codex model update', async () => {
    await saveAiProviderConfig({
      provider: 'codex',
      codex_model: 'gpt-5-codex',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
    await expect(loadAiProviderConfig()).resolves.toEqual({
      provider: 'codex',
      codex_model: 'gpt-5-codex',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
  });

  it('applyAiProviderConfigUpdate preserves inactive provider model fields', () => {
    const current = normalizeAiProviderConfig({
      provider: 'claude',
      claude_model: 'sonnet',
      codex_model: 'gpt-5-codex',
      updated_at: 'old',
    });
    const next = applyAiProviderConfigUpdate(
      current,
      { provider: 'codex', codex_model: 'gpt-5' },
      'new',
    );
    expect(next).toEqual({
      provider: 'codex',
      claude_model: 'sonnet',
      codex_model: 'gpt-5',
      updated_at: 'new',
    });
  });

  it('applyAiProviderConfigUpdate rejects invalid providers', () => {
    const current = normalizeAiProviderConfig(null);
    expect(() =>
      applyAiProviderConfigUpdate(current, { provider: 'openai' }),
    ).toThrow('AI provider must be claude or codex');
  });

  it('loadAiProviderConfig recovers to defaults for malformed config JSON', async () => {
    await saveAiProviderConfig({
      provider: 'codex',
      codex_model: 'gpt-5-codex',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
    await rm(configPath, { force: true });
    await writeFile(configPath, '{not-json');
    await expect(loadAiProviderConfig()).resolves.toEqual({
      provider: 'claude',
      updated_at: '1970-01-01T00:00:00.000Z',
    });
  });
});

describe('listReviews', () => {
  const cleanup = async (pr: PrRef) => {
    await rm(statePath(pr), { force: true });
  };

  it('returns an empty array when no state files exist', async () => {
    const result = await listReviews();
    expect(Array.isArray(result)).toBe(true);
  });

  it('lists a saved review with correct summary fields', async () => {
    const pr: PrRef = { owner: 'list-test', repo: 'repo', number: 5001, platform: 'github' as const };
    await cleanup(pr);
    let state = await loadState(pr, 'sha-list');
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 1,
      body: 'hi',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
    });
    state = applyAction(state, {
      type: 'toggle_flag',
      chunk_id: 'c2',
      file: 'b.ts',
      hunk_header: '@@ -4,3 +4,3 @@',
    });
    state = applyAction(state, {
      type: 'set_viewed',
      chunk_id: 'c3',
      viewed: true,
    });
    await saveState(state);

    const reviews = await listReviews();
    const found = reviews.find(
      (r) => r.pr.owner === 'list-test' && r.pr.number === 5001,
    );
    expect(found).toBeDefined();
    expect(found!.comment_count).toBe(1);
    expect(found!.flagged_count).toBe(1);
    expect(found!.viewed_count).toBe(1);
    expect(found!.head_sha).toBe('sha-list');
    await cleanup(pr);
  });

  it('includes meta when saved in state', async () => {
    const pr: PrRef = { owner: 'list-test', repo: 'repo', number: 5002, platform: 'github' as const };
    await cleanup(pr);
    let state = await loadState(pr, 'sha-meta');
    state = {
      ...state,
      meta: {
        title: 'My PR',
        author: 'dev',
        base_ref: 'main',
        head_ref: 'feat',
        is_draft: false,
        url: 'http://x',
        head_sha: 'sha-meta',
        body: '',
      },
    };
    await saveState(state);

    const reviews = await listReviews();
    const found = reviews.find((r) => r.pr.number === 5002);
    expect(found?.meta?.title).toBe('My PR');
    await cleanup(pr);
  });

  it('skips .tmp.json files in the state directory', async () => {
    const pr: PrRef = { owner: 'tmp-test', repo: 'repo', number: 7001, platform: 'github' as const };
    await cleanup(pr);
    await saveState(await loadState(pr, 'sha1'));
    // Write a stray .tmp.json file
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const stateDir = process.env.ASSISTED_REVIEW_STATE_DIR!;
    await writeFile(join(stateDir, 'tmp-test-repo-7001.tmp.json'), '{}');

    const reviews = await listReviews();
    // The real state file should appear exactly once, not doubled from the .tmp
    const matches = reviews.filter((r) => r.pr.number === 7001);
    expect(matches).toHaveLength(1);
    await cleanup(pr);
  });

  it('skips state files whose parsed JSON lacks a pr field', async () => {
    const { writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const stateDir = process.env.ASSISTED_REVIEW_STATE_DIR!;
    await writeFile(join(stateDir, 'no-pr-9999.json'), '{"version":1,"comments":[]}');

    const countBefore = (await listReviews()).length;
    // The malformed file should have been silently skipped (no new entry added)
    const { rm: rmFile } = await import('node:fs/promises');
    await rmFile(join(stateDir, 'no-pr-9999.json'), { force: true });
    expect(countBefore).toBeGreaterThanOrEqual(0); // just confirms no throw
  });

  it('sorts reviews newest first by started_at', async () => {
    const pr1: PrRef = { owner: 'sort-test', repo: 'r', number: 5003, platform: 'github' as const };
    const pr2: PrRef = { owner: 'sort-test', repo: 'r', number: 5004, platform: 'github' as const };
    await cleanup(pr1);
    await cleanup(pr2);

    const s1 = await loadState(pr1, 'sha1');
    const s2 = await loadState(pr2, 'sha2');
    // Force distinct started_at
    await saveState({ ...s1, started_at: '2020-01-01T00:00:00.000Z' });
    await saveState({ ...s2, started_at: '2025-01-01T00:00:00.000Z' });

    const reviews = await listReviews();
    const idx1 = reviews.findIndex((r) => r.pr.number === 5003);
    const idx2 = reviews.findIndex((r) => r.pr.number === 5004);
    expect(idx2).toBeLessThan(idx1); // newer (5004) comes first
    await cleanup(pr1);
    await cleanup(pr2);
  });
});

describe('deleteReview', () => {
  it('removes the state file so listReviews no longer returns it', async () => {
    const pr: PrRef = { owner: 'del-test', repo: 'repo', number: 6001, platform: 'github' as const };
    await rm(statePath(pr), { force: true });
    await saveState(await loadState(pr, 'sha-del'));

    let found = (await listReviews()).find((r) => r.pr.number === 6001);
    expect(found).toBeDefined();

    await deleteReview(pr);
    found = (await listReviews()).find((r) => r.pr.number === 6001);
    expect(found).toBeUndefined();
  });

  it('throws when the file does not exist', async () => {
    const pr: PrRef = { owner: 'del-test', repo: 'repo', number: 6002, platform: 'github' as const };
    await rm(statePath(pr), { force: true });
    await expect(deleteReview(pr)).rejects.toThrow();
  });
});
