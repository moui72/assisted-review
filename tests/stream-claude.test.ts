// Tests for streamClaude — spawns `claude -p --output-format stream-json`.
// node:child_process is mocked so no real claude binary is needed.

import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import { streamClaude } from '../src/claude';

function makeChild() {
  const child = new EventEmitter() as ReturnType<typeof spawn>;
  (child as any).stdout = new EventEmitter();
  (child as any).stderr = new EventEmitter();
  (child as any).stdin = { write: vi.fn(), end: vi.fn() };
  (child as any).killed = false;
  (child as any).kill = vi.fn(() => { (child as any).killed = true; });
  return child;
}

function jsonLine(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj) + '\n');
}

describe('streamClaude', () => {
  afterEach(() => vi.mocked(spawn).mockReset());

  it('calls onDelta for each text_delta and onDone when result arrives', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const deltas: string[] = [];
    const result = await new Promise<string>((resolve, reject) => {
      streamClaude('prompt text', {
        onDelta: (t) => deltas.push(t),
        onDone: resolve,
        onError: reject,
      });

      process.nextTick(() => {
        (child as any).stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } },
        }));
        (child as any).stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
        }));
        (child as any).stdout.emit('data', jsonLine({
          type: 'result',
          result: 'hello world',
          is_error: false,
        }));
      });
    });

    expect(deltas).toEqual(['hello', ' world']);
    expect(result).toBe('hello world');
  });

  it('uses accumulated full text when result has no string result field', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const done = await new Promise<string>((resolve, reject) => {
      streamClaude('p', {
        onDelta: () => {},
        onDone: resolve,
        onError: reject,
      });
      process.nextTick(() => {
        (child as any).stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'accum' } },
        }));
        // result with non-string result field — should fall back to `full`
        (child as any).stdout.emit('data', jsonLine({ type: 'result', result: null, is_error: false }));
      });
    });

    expect(done).toBe('accum');
  });

  it('calls onError when result has is_error: true', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: reject, onError: resolve });
      process.nextTick(() => {
        (child as any).stdout.emit('data', jsonLine({
          type: 'result',
          result: 'tool use not allowed',
          is_error: true,
        }));
      });
    });

    expect(err).toBe('tool use not allowed');
  });

  it('calls onError with fallback message when error result is non-string', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: reject, onError: resolve });
      process.nextTick(() => {
        (child as any).stdout.emit('data', jsonLine({ type: 'result', result: null, is_error: true }));
      });
    });

    expect(err).toContain('error');
  });

  it('calls onError when the child process fails to spawn', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: reject, onError: resolve });
      process.nextTick(() => {
        child.emit('error', new Error('ENOENT'));
      });
    });

    expect(err).toMatch(/ENOENT/);
  });

  it('calls onError when the child exits non-zero', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: reject, onError: resolve });
      process.nextTick(() => {
        (child as any).stderr.emit('data', Buffer.from('rate limited'));
        child.emit('close', 1);
      });
    });

    expect(err).toContain('rate limited');
  });

  it('calls onDone when child exits 0 without a result event', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const done = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        (child as any).stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'streamed' } },
        }));
        child.emit('close', 0);
      });
    });

    expect(done).toBe('streamed');
  });

  it('ignores non-JSON noise on stdout', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const done = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        (child as any).stdout.emit('data', Buffer.from('not json at all\n'));
        (child as any).stdout.emit('data', Buffer.from('   \n')); // whitespace-only line
        (child as any).stdout.emit('data', jsonLine({ type: 'result', result: 'ok', is_error: false }));
      });
    });

    expect(done).toBe('ok');
  });

  it('cancel function kills the child', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    const cancel = streamClaude('p', { onDelta: () => {}, onDone: () => {}, onError: () => {} });
    cancel();

    expect((child as any).kill).toHaveBeenCalled();
    expect((child as any).killed).toBe(true);
  });

  it('settled handlers are called at most once', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    let doneCount = 0;
    let errorCount = 0;
    await new Promise<void>((resolve) => {
      streamClaude('p', {
        onDelta: () => {},
        onDone: () => { doneCount++; resolve(); },
        onError: () => { errorCount++; resolve(); },
      });
      process.nextTick(() => {
        // Emit result then close 0 — only the first should trigger onDone
        (child as any).stdout.emit('data', jsonLine({ type: 'result', result: 'x', is_error: false }));
        child.emit('close', 0);
      });
    });

    expect(doneCount).toBe(1);
    expect(errorCount).toBe(0);
  });

  it('writes the prompt to stdin and closes it', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child);

    streamClaude('my prompt', { onDelta: () => {}, onDone: () => {}, onError: () => {} });

    expect((child as any).stdin.write).toHaveBeenCalledWith('my prompt');
    expect((child as any).stdin.end).toHaveBeenCalled();
  });
});
