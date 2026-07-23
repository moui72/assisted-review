import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import { buildCodexExecArgs, streamCodex } from '../src/codex';

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

describe('buildCodexExecArgs', () => {
  it('uses non-interactive stdin prompt mode with JSONL output', () => {
    const args = buildCodexExecArgs();
    expect(args.slice(0, 2)).toEqual(['exec', '--json']);
    expect(args.at(-1)).toBe('-');
  });

  it('runs Codex with the closest supported read-only execution controls', () => {
    const args = buildCodexExecArgs();
    expect(args).toContain('--ephemeral');
    expect(args).toContain('--sandbox');
    expect(args).toContain('read-only');
    expect(args).toContain('--skip-git-repo-check');
  });

  it('defaults to a temp cwd when no repo access is requested', () => {
    const args = buildCodexExecArgs();
    expect(args).toContain('--cd');
    expect(args[args.indexOf('--cd') + 1]).toBe(tmpdir());
  });

  it('uses the supplied cwd for repo-read mode', () => {
    const args = buildCodexExecArgs({ cwd: '/repo/path' });
    expect(args[args.indexOf('--cd') + 1]).toBe('/repo/path');
  });

  it('forwards an explicit model when one is configured', () => {
    const args = buildCodexExecArgs({ model: 'gpt-5-codex' });
    expect(args).toContain('--model');
    expect(args[args.indexOf('--model') + 1]).toBe('gpt-5-codex');
  });
});

describe('streamCodex', () => {
  afterEach(() => vi.mocked(spawn).mockReset());

  it('spawns codex exec, writes the prompt to stdin, and forwards model/cwd args', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    streamCodex(
      'prompt text',
      { onDelta: () => {}, onDone: () => {}, onError: () => {} },
      { cwd: '/repo/path', model: 'gpt-5-codex' },
    );
    const [cmd, args, opts] = vi.mocked(spawn).mock.calls[0];
    expect(cmd).toBe('codex');
    expect(args).toContain('--model');
    expect((args as string[])[(args as string[]).indexOf('--model') + 1]).toBe('gpt-5-codex');
    expect((args as string[])[(args as string[]).indexOf('--cd') + 1]).toBe('/repo/path');
    expect((opts as { cwd?: string }).cwd).toBe('/repo/path');
    expect(child.stdin.write).toHaveBeenCalledWith('prompt text');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('forwards text deltas and completes on result', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const deltas: string[] = [];
    const done = await new Promise<string>((resolve, reject) => {
      streamCodex('p', {
        onDelta: (text) => deltas.push(text),
        onDone: resolve,
        onError: reject,
      });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'response.output_text.delta', delta: 'hello' }));
        child.stdout.emit('data', jsonLine({ type: 'response.output_text.delta', delta: { text: ' world' } }));
        child.stdout.emit('data', jsonLine({ type: 'result', result: 'hello world' }));
      });
    });
    expect(deltas).toEqual(['hello', ' world']);
    expect(done).toBe('hello world');
  });

  it('uses accumulated deltas when the process exits cleanly without a result', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const done = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'agent_message_delta', message: 'partial' }));
        child.emit('close', 0);
      });
    });
    expect(done).toBe('partial');
  });

  it('reads final text from item.completed message content', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const done = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({
          type: 'item.completed',
          item: { content: [{ text: 'final answer' }] },
        }));
      });
    });
    expect(done).toBe('final answer');
  });

  it('calls onError for Codex error events and non-zero exits', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'error', message: 'blocked' }));
        child.emit('close', 1);
      });
    });
    expect(err).toBe('blocked');
  });

  it('extracts the error message from a string `error` field', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'turn.error', error: 'sandbox denied write' }));
      });
    });
    expect(err).toBe('sandbox denied write');
  });

  it('extracts the error message from an `error.message` object field', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'stream_error', error: { message: 'rate limited' } }));
      });
    });
    expect(err).toBe('rate limited');
  });

  it('falls back to a generic message for an error event with no message/error field', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'error' }));
      });
    });
    expect(err).toBe('Codex returned an error');
  });

  it('extracts delta text from a `text` field when the event type includes "delta"', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const deltas: string[] = [];
    await new Promise<void>((resolve) => {
      streamCodex('p', { onDelta: (t) => deltas.push(t), onDone: () => resolve(), onError: () => resolve() });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({ type: 'output_text.delta', text: 'streamed chunk' }));
        child.emit('close', 0);
      });
    });
    expect(deltas).toEqual(['streamed chunk']);
  });

  it('reads final text from `content` array when no `item` wrapper is present', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const done = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        child.stdout.emit('data', jsonLine({
          type: 'agent_message',
          content: [{ text: 'final from content' }],
        }));
      });
    });
    expect(done).toBe('final from content');
  });

  it('ignores malformed JSON lines on stdout', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const done = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: resolve, onError: reject });
      process.nextTick(() => {
        child.stdout.emit('data', Buffer.from('not json at all\n'));
        child.stdout.emit('data', Buffer.from('   \n'));
        child.stdout.emit('data', jsonLine({ type: 'result', result: 'ok' }));
      });
    });
    expect(done).toBe('ok');
  });

  it('suppresses EPIPE stdin write errors without calling onError', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const onError = vi.fn();
    const done = await new Promise<string>((resolve) => {
      streamCodex('p', { onDelta: () => {}, onDone: resolve, onError });
      process.nextTick(() => {
        const epipe = Object.assign(new Error('EPIPE'), { code: 'EPIPE' });
        child.stdin.emit('error', epipe);
        child.stdout.emit('data', jsonLine({ type: 'result', result: 'ok' }));
      });
    });
    expect(done).toBe('ok');
    expect(onError).not.toHaveBeenCalled();
  });

  it('surfaces non-EPIPE stdin write errors via onError', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => {
        const otherErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
        child.stdin.emit('error', otherErr);
      });
    });
    expect(err).toContain('stdin write failed');
  });

  it('falls back to an exit-code message when the process exits non-zero with no stderr', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => child.emit('close', 1));
    });
    expect(err).toBe('codex exited with code 1');
  });

  it('defaults the spawn cwd to the OS temp dir when none is provided', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    streamCodex('p', { onDelta: () => {}, onDone: () => {}, onError: () => {} });
    const [, , opts] = vi.mocked(spawn).mock.calls[0];
    expect((opts as { cwd?: string }).cwd).toBe(tmpdir());
  });

  it('calls onError when Codex fails to spawn', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const err = await new Promise<string>((resolve, reject) => {
      streamCodex('p', { onDelta: () => {}, onDone: () => reject(new Error('unexpected done')), onError: resolve });
      process.nextTick(() => child.emit('error', new Error('ENOENT')));
    });
    expect(err).toMatch(/failed to start codex/);
  });

  it('cancel kills the child process', () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(asSpawnResult(child));
    const cancel = streamCodex('p', { onDelta: () => {}, onDone: () => {}, onError: () => {} });
    cancel();
    expect(child.kill).toHaveBeenCalled();
  });
});
