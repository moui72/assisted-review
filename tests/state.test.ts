import { rm } from 'node:fs/promises';
import { applyAction, loadState, migrate, saveState, statePath } from '../src/state';
import type { Action, PrRef, ReviewState } from '../src/types';
import { STATE_VERSION } from '../src/types';

const baseState = (pr: PrRef): ReviewState => ({
  version: STATE_VERSION,
  pr,
  head_sha: 'sha0',
  started_at: '2020-01-01T00:00:00.000Z',
  comments: [],
  flagged: [],
  viewed: [],
  notes: [],
});

describe('applyAction', () => {
  const pr: PrRef = { owner: 'o', repo: 'r', number: 1 };

  it('add_comment creates a comment with id, timestamps and fields', () => {
    const state = baseState(pr);
    const action: Action = {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 12,
      body: 'looks good',
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
    });
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c2',
      side: 'RIGHT',
      line: 2,
      body: 'second',
    });
    const targetId = state.comments[0].id;
    const otherBefore = state.comments[1];
    // Pin the clock forward so the refreshed updated_at is observably distinct
    // from the created_at set on the same millisecond above.
    const later = '2099-01-01T00:00:00.000Z';
    const spy = jest
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
    });
    const id = state.comments[0].id;
    const next = applyAction(state, { type: 'delete_comment', id });
    expect(next.comments).toHaveLength(0);
  });

  it('toggle_flag adds then removes on repeat', () => {
    const state = baseState(pr);
    const flagged = applyAction(state, { type: 'toggle_flag', chunk_id: 'c1' });
    expect(flagged.flagged).toEqual(['c1']);
    const unflagged = applyAction(flagged, {
      type: 'toggle_flag',
      chunk_id: 'c1',
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
});

describe('migrate', () => {
  const pr: PrRef = { owner: 'o', repo: 'r', number: 1 };

  it('v0 with no notes field gets notes: [] and version stamped', () => {
    const raw = { pr, head_sha: 'sha', started_at: '2020-01-01T00:00:00.000Z', comments: [], flagged: [], viewed: [] };
    const result = migrate(raw);
    expect(result.version).toBe(STATE_VERSION);
    expect(result.notes).toEqual([]);
  });

  it('v0 with existing notes array preserves notes', () => {
    const note = { id: 'n1', chunk_id: 'c1', kind: 'initial' as const, body: 'hi', created_at: '2020-01-01T00:00:00.000Z' };
    const raw = { pr, head_sha: 'sha', started_at: '2020-01-01T00:00:00.000Z', comments: [], flagged: [], viewed: [], notes: [note] };
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
    const raw: Record<string, unknown> = { pr, head_sha: 'sha', started_at: '2020-01-01T00:00:00.000Z', comments: [], flagged: [], viewed: [] };
    migrate(raw);
    expect('version' in raw).toBe(false);
    expect('notes' in raw).toBe(false);
  });
});

describe('loadState / saveState persistence', () => {
  // Distinct PR numbers per test to avoid file collisions.
  const cleanup = async (pr: PrRef) => {
    await rm(statePath(pr), { force: true });
    await rm(`${statePath(pr)}.tmp`, { force: true });
  };

  it('loadState on a non-existent file returns empty state with given head_sha and started_at', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1001 };
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
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1002 };
    await cleanup(pr);
    let state = await loadState(pr, 'sha1');
    state = applyAction(state, {
      type: 'add_comment',
      chunk_id: 'c1',
      side: 'RIGHT',
      line: 5,
      body: 'hi',
    });
    state = applyAction(state, { type: 'toggle_flag', chunk_id: 'c2' });
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
    expect(loaded.flagged).toEqual(['c2']);
    expect(loaded.viewed).toEqual(['c3']);
    await cleanup(pr);
  });

  it('saved state includes version and round-trips it', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1004 };
    await cleanup(pr);
    const state = await loadState(pr, 'sha1');
    expect(state.version).toBe(STATE_VERSION);
    await saveState(state);
    const loaded = await loadState(pr, 'sha1');
    expect(loaded.version).toBe(STATE_VERSION);
    await cleanup(pr);
  });

  it('loadState refreshes head_sha even when prior state exists', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1003 };
    await cleanup(pr);
    const state = await loadState(pr, 'old-sha');
    await saveState(state);
    const reloaded = await loadState(pr, 'new-sha');
    expect(reloaded.head_sha).toBe('new-sha');
    await cleanup(pr);
  });
});
