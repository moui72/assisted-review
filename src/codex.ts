import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { AiStreamHandlers, AiStreamOptions } from './ai-provider.js';

export interface CodexExecOptions {
  cwd?: string;
  model?: string;
}

export function buildCodexExecArgs(opts: CodexExecOptions = {}): string[] {
  return [
    'exec',
    '--json',
    '--ephemeral',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--cd',
    opts.cwd ?? tmpdir(),
    ...(opts.model ? ['--model', opts.model] : []),
    '-',
  ];
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const obj = part as Record<string, unknown>;
      return typeof obj.text === 'string' ? obj.text : '';
    })
    .join('');
}

function extractDelta(ev: Record<string, unknown>): string | undefined {
  if (typeof ev.delta === 'string') return ev.delta;
  if (ev.delta && typeof ev.delta === 'object') {
    const delta = ev.delta as Record<string, unknown>;
    if (typeof delta.text === 'string') return delta.text;
  }
  if (typeof ev.text === 'string' && typeof ev.type === 'string' && ev.type.includes('delta')) {
    return ev.text;
  }
  if (typeof ev.message === 'string' && typeof ev.type === 'string' && ev.type.includes('delta')) {
    return ev.message;
  }
  // Handle item.updated events with item.text
  if (ev.item && typeof ev.item === 'object' && typeof ev.type === 'string' && ev.type === 'item.updated') {
    const item = ev.item as Record<string, unknown>;
    if (typeof item.text === 'string') return item.text;
  }
  return undefined;
}

function extractFinal(ev: Record<string, unknown>): string | undefined {
  if (typeof ev.result === 'string') return ev.result;
  if (typeof ev.message === 'string' && ev.type === 'agent_message') return ev.message;
  if (ev.item && typeof ev.item === 'object') {
    const item = ev.item as Record<string, unknown>;
    // First try item.text (direct string field for item.completed)
    if (typeof item.text === 'string') return item.text;
    // Fall back to item.content
    const text = textFromContent(item.content);
    if (text) return text;
  }
  const text = textFromContent(ev.content);
  return text || undefined;
}

function extractError(ev: Record<string, unknown>): string | undefined {
  const type = typeof ev.type === 'string' ? ev.type.toLowerCase() : '';
  if (!type.includes('error')) return undefined;
  if (typeof ev.message === 'string') return ev.message;
  if (typeof ev.error === 'string') return ev.error;
  if (ev.error && typeof ev.error === 'object') {
    const err = ev.error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
  }
  return 'Codex returned an error';
}

export function streamCodex(
  prompt: string,
  handlers: AiStreamHandlers,
  opts: AiStreamOptions = {},
): () => void {
  const child = spawn('codex', buildCodexExecArgs({ cwd: opts.cwd, model: opts.model }), {
    cwd: opts.cwd ?? tmpdir(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buf = '';
  let full = '';
  let settled = false;
  let stderr = '';

  function finishOk(text: string) {
    if (settled) return;
    settled = true;
    handlers.onDone(text);
  }
  function finishErr(msg: string) {
    if (settled) return;
    settled = true;
    handlers.onError(msg);
  }

  child.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      const error = extractError(ev);
      if (error) {
        finishErr(error);
        continue;
      }
      const delta = extractDelta(ev);
      if (delta) {
        full += delta;
        handlers.onDelta(delta);
        continue;
      }
      const final = extractFinal(ev);
      if (final && typeof ev.type === 'string' && ['result', 'agent_message', 'item.completed'].includes(ev.type)) {
        finishOk(final);
      }
    }
  });

  child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
  child.on('error', (e) =>
    finishErr(`failed to start codex: ${e.message} (is the \`codex\` CLI installed and on PATH?)`),
  );
  child.on('close', (code) => {
    if (code === 0) finishOk(full);
    else finishErr(stderr.trim() || `codex exited with code ${code}`);
  });

  child.stdin.write(prompt);
  child.stdin.end();
  child.stdin.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code !== 'EPIPE') finishErr(`stdin write failed: ${e.message}`);
  });

  return () => {
    if (!child.killed) child.kill();
  };
}
