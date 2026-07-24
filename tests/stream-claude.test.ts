// Tests for streamClaude — spawns `claude -p --output-format stream-json`.
// node:child_process is mocked so no real claude binary is needed.

import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import { streamClaude } from '../src/claude';

function makeChild() {
  return Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() }),
    killed: false,
    kill: vi.fn(),
  });
}

type MockChild = ReturnType<typeof makeChild>;

function asSpawnResult(child: MockChild): ReturnType<typeof spawn> {
  return child as unknown as ReturnType<typeof spawn>;
}

function jsonLine(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj) + '\n');
}

describe('streamClaude', () => {
  afterEach(() => vi.mocked(spawn).mockReset());

  it('defaults to tmpdir cwd and disallows Read/Grep/Glob', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    streamClaude('p', { onDelta: () => {}, onDone: () => {}, onError: () => {} });
    const [, args, opts] = vi.mocked(spawn).mock.calls[0];
    expect((args as string[]).join(' ')).toMatch(/--disallowed-tools.*\bRead\b.*\bGrep\b.*\bGlob\b/);
    expect((opts as { cwd?: string }).cwd).not.toBeUndefined();
  });

  it('allowRepoRead: true drops Read/Grep/Glob from --disallowed-tools and uses the given cwd', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    streamClaude(
      'p',
      { onDelta: () => {}, onDone: () => {}, onError: () => {} },
      { cwd: '/some/repo', allowRepoRead: true },
    );
    const [, args, opts] = vi.mocked(spawn).mock.calls[0];
    const argList = args as string[];
    expect(argList).not.toContain('Read');
    expect(argList).not.toContain('Grep');
    expect(argList).not.toContain('Glob');
    expect(argList).toContain('Bash');
    expect(argList).toContain('Edit');
    expect((opts as { cwd?: string }).cwd).toBe('/some/repo');
  });

  it('passes an explicit Claude model when configured', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    streamClaude(
      'p',
      { onDelta: () => {}, onDone: () => {}, onError: () => {} },
      { model: 'claude-sonnet' },
    );
    const [, args] = vi.mocked(spawn).mock.calls[0];
    expect(args).toContain('--model');
    expect((args as string[])[(args as string[]).indexOf('--model') + 1]).toBe('claude-sonnet');
  });

  it('calls onDelta for each text_delta and onDone when result arrives', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const deltas: string[] = [];
    const result = await new Promise<string>((resolve, reject) => {
      streamClaude('prompt text', {
        onDelta: (t) => deltas.push(t),
        onDone: resolve,
        onError: reject,
      });

      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } },
        }));
        child.stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
        }));
        child.stdout.emit('data', jsonLine({
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
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const done = await new Promise<string>((resolve, reject) => {
      streamClaude('p', {
        onDelta: () => {},
        onDone: resolve,
        onError: reject,
      });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({
          type: 'stream_event',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'accum' } },
        }));
        // result with non-string result field — falls back to accumulated `full`
        child.stdout.emit('data', jsonLine({ type: 'result', result: null, is_error: false }));
      });
    });

    expect(done).toBe('accum');
  });

  it('calls onError when result has is_error: true', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({
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
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'result', result: null, is_error: true }));
      });
    });

    expect(err).toContain('error');
  });

  it('calls onError when the child process fails to spawn', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.emit('error', new Error('ENOENT'));
      });
    });

    expect(err).toMatch(/ENOENT/);
  });

  it('calls onError when the child exits non-zero', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stderr.emit('data', Buffer.from('rate limited'));
        child.emit('close', 1);
      });
    });

    expect(err).toContain('rate limited');
  });

  it('calls onDone when child exits 0 without a result event', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const done = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({
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
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const done = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        child.stdout.emit('data', Buffer.from('not json at all\n'));
        child.stdout.emit('data', Buffer.from('   \n')); // whitespace-only line
        child.stdout.emit('data', jsonLine({ type: 'result', result: 'ok', is_error: false }));
      });
    });

    expect(done).toBe('ok');
  });

  it('cancel function kills the child', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const cancel = streamClaude('p', { onDelta: () => {}, onDone: () => {}, onError: () => {} });
    cancel();

    expect(child.kill).toHaveBeenCalled();
  });

  it('settled handlers are called at most once', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

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
        child.stdout.emit('data', jsonLine({ type: 'result', result: 'x', is_error: false }));
        child.emit('close', 0);
      });
    });

    expect(doneCount).toBe(1);
    expect(errorCount).toBe(0);
  });

  it('writes the prompt to stdin and closes it', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    streamClaude('my prompt', { onDelta: () => {}, onDone: () => {}, onError: () => {} });

    expect(child.stdin.write).toHaveBeenCalledWith('my prompt');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('suppresses EPIPE stdin write errors without calling onError', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const onError = vi.fn();
    const done = await new Promise<string>((resolve) => {
      streamClaude('p', { onDelta: () => {}, onDone: resolve, onError });
      process.nextTick(() => {
        const epipe = Object.assign(new Error('EPIPE'), { code: 'EPIPE' });
        child.stdin.emit('error', epipe);
        child.stdout.emit('data', jsonLine({ type: 'result', result: 'ok', is_error: false }));
      });
    });

    expect(done).toBe('ok');
    expect(onError).not.toHaveBeenCalled();
  });

  it('surfaces non-EPIPE stdin write errors via onError', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));

    const err = await new Promise<string>((resolve, reject) => {
      streamClaude('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        const otherErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
        child.stdin.emit('error', otherErr);
      });
    });

    expect(err).toContain('stdin write failed');
  });
});
