// Headless Claude bridge. Spawns `claude -p` in stream-json mode, feeds the
// prompt on stdin, and surfaces text deltas + completion. Runs in a temp cwd
// with tools disabled so it answers purely from the prompt (the diff), without
// loading this project's context or touching the filesystem.

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { AiNoteKind, Chunk, JiraContext, PrMeta, StoredNote } from './types.js';

const MAX_DIFF_CHARS = 12000;
const MAX_JIRA_DESC = 1200;

const NO_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'Read',
  'Grep',
  'Glob',
  'WebFetch',
  'WebSearch',
  'Task',
  'NotebookEdit',
];

export interface ClaudeHandlers {
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (message: string) => void;
}

function fileContentsBlock(fileContents?: Map<string, string>): string {
  if (!fileContents || fileContents.size === 0) return '';
  const blocks = [...fileContents.entries()].map(
    ([path, content]) => `Full file contents: ${path}\n\`\`\`\n${clip(content, MAX_DIFF_CHARS)}\n\`\`\``,
  );
  return `\n\n${blocks.join('\n\n')}`;
}

/** Render prior notes (excluding `error`) as a labeled transcript block, so a
 *  follow-up question has the conversation's history instead of a cold start. */
function historyBlock(history?: StoredNote[]): string {
  const entries = (history ?? []).filter((n) => n.kind !== 'error');
  if (entries.length === 0) return '';
  const turns = entries.map((n) =>
    n.kind === 'investigation' && n.prompt
      ? `Reviewer asked: "${n.prompt}"\nYou answered: ${n.body}`
      : `You summarized:\n${n.body}`,
  );
  return `\n\nPrior conversation:\n${turns.join('\n\n')}`;
}

/** Build the prompt for a chunk. Empty question → an "explain this hunk" note.
 *  `fileContents` (investigation mode 'api') appends full file text for
 *  diff-touched files, in addition to the diff hunk itself. */
export function buildPrompt(
  chunk: Chunk,
  kind: AiNoteKind,
  question: string,
  fileContents?: Map<string, string>,
  allowRepoRead?: boolean,
  history?: StoredNote[],
): string {
  const intro =
    'You are assisting a code reviewer reviewing a GitHub pull request. ' +
    'Be concise and direct — lead with the most important point, no hedging, no preamble. ' +
    (allowRepoRead
      ? 'The diff hunk is shown below; you may also use Read/Grep/Glob to investigate the surrounding repo (checked out at the current working directory) for additional context.'
      : 'Answer only from the diff shown; do not use tools.');
  const ctx =
    `File: ${chunk.file}\n\nDiff hunk:\n\`\`\`diff\n${chunk.diff}\n\`\`\`` +
    fileContentsBlock(fileContents) +
    historyBlock(history);
  if (kind === 'investigation' && question.trim()) {
    return `${intro}\n\nThe reviewer asks about this hunk: "${question.trim()}"\n\n${ctx}\n\nAnswer in 2-5 sentences or a few short bullets.`;
  }
  return (
    `${intro}\n\n${ctx}\n\n` +
    `Flag the most important thing the reviewer should notice about this change in 2-4 sentences ` +
    `(a risk, bug, or behavior change); if nothing stands out, say so briefly. ` +
    `Then add a final line in exactly this format: "Suggested action: <one concrete next step>" ` +
    `— e.g., ask the author to clarify X, request a change to Y, or verify Z. Keep the action to one sentence. ` +
    `Do not number or add headings to the two parts.`
  );
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '\n… (truncated)' : s;
}

/** Build the whole-PR overview prompt. Empty question → summarize; else answer it.
 *  `fileContents` (investigation mode 'api') appends full file text for
 *  diff-touched files, in addition to the combined diff. */
export function buildOverviewPrompt(
  meta: PrMeta,
  chunks: Chunk[],
  jira: JiraContext,
  question: string,
  fileContents?: Map<string, string>,
  allowRepoRead?: boolean,
  history?: StoredNote[],
): string {
  const files = [...new Set(chunks.map((c) => c.file))];
  const combinedDiff = clip(chunks.map((c) => c.diff).join('\n'), MAX_DIFF_CHARS);

  const task = question.trim()
    ? `Answer the reviewer's question about this pull request: "${question.trim()}". Be concise and concrete.`
    : `In 3-6 sentences, orient the reviewer: summarize what this PR changes and why — the intent and the shape of the change across files. Ground it in the description and ticket if provided. No preamble, no headings, no "suggested action" line.`;

  const repoNote = allowRepoRead
    ? ' You may also use Read/Grep/Glob to investigate the repo (checked out at the current working directory) for additional context.'
    : '';

  const parts = [
    `You are orienting a code reviewer before they review a pull request. ${task}${repoNote}`,
    `PR title: ${meta.title}`,
  ];
  if (meta.body.trim()) parts.push(`PR description:\n${clip(meta.body.trim(), 4000)}`);
  if (jira.available && jira.issues.length) {
    const tix = jira.issues
      .map((i) => `${i.key} [${i.type} · ${i.status}]: ${i.summary}\n${clip(i.description, MAX_JIRA_DESC)}`)
      .join('\n\n');
    let block = `Linked Jira issue(s):\n${tix}`;
    if (jira.epic)
      block += `\n\nParent epic ${jira.epic.key}: ${jira.epic.summary}\n${clip(jira.epic.description, MAX_JIRA_DESC)}`;
    parts.push(block);
  }
  parts.push(`Files changed (${files.length}): ${files.join(', ')}`);
  parts.push(`Combined diff (may be truncated):\n\`\`\`diff\n${combinedDiff}\n\`\`\``);
  if (fileContents && fileContents.size > 0) parts.push(fileContentsBlock(fileContents).trim());
  const hist = historyBlock(history).trim();
  if (hist) parts.push(hist);
  return parts.join('\n\n');
}

/**
 * Split an initial note into its observation body and the trailing
 * "Suggested action: …" line (tolerant of markdown bold around the label).
 */
export function splitSuggestedAction(text: string): { body: string; suggestedAction?: string } {
  // Strip a leading enumerator/heading the model sometimes adds (e.g. "1. ").
  const clean = (s: string) => s.trim().replace(/^\s*\d+\.\s+/, '');
  const m = text.match(/\n+\s*\*{0,2}\s*suggested\s+action\s*\*{0,2}\s*:\s*\*{0,2}\s*/i);
  if (!m || m.index === undefined) return { body: clean(text) };
  const action = text.slice(m.index + m[0].length).trim();
  if (!action) return { body: clean(text) };
  return { body: clean(text.slice(0, m.index)), suggestedAction: action };
}

export interface StreamClaudeOptions {
  /** Working directory for the subprocess. Defaults to a temp dir (no repo access). */
  cwd?: string;
  /** When true, drops Read/Grep/Glob from --disallowed-tools (still read-only — no
   *  Bash/Edit/Write/WebFetch/WebSearch/Task/NotebookEdit, ever). Default false. */
  allowRepoRead?: boolean;
}

/** Spawn claude and stream its answer. Returns a cancel function. */
export function streamClaude(
  prompt: string,
  handlers: ClaudeHandlers,
  opts: StreamClaudeOptions = {},
): () => void {
  const disallowedTools = opts.allowRepoRead
    ? NO_TOOLS.filter((t) => !['Read', 'Grep', 'Glob'].includes(t))
    : NO_TOOLS;
  const child = spawn(
    'claude',
    [
      '-p',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--disallowed-tools',
      ...disallowedTools,
    ],
    { cwd: opts.cwd ?? tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] },
  );

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
        ev = JSON.parse(line);
      } catch {
        continue; // ignore non-JSON noise
      }
      if (ev.type === 'stream_event') {
        const inner = ev.event as { type?: string; delta?: { type?: string; text?: string } };
        if (inner?.type === 'content_block_delta' && inner.delta?.type === 'text_delta') {
          const t = inner.delta.text ?? '';
          full += t;
          handlers.onDelta(t);
        }
      } else if (ev.type === 'result') {
        if (ev.is_error) finishErr(typeof ev.result === 'string' ? ev.result : 'Claude returned an error');
        else finishOk(typeof ev.result === 'string' ? ev.result : full);
      }
    }
  });

  child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
  child.on('error', (e) =>
    finishErr(`failed to start claude: ${e.message} (is the \`claude\` CLI installed and on PATH?)`),
  );
  child.on('close', (code) => {
    if (code === 0) finishOk(full);
    else finishErr(stderr.trim() || `claude exited with code ${code}`);
  });

  child.stdin.write(prompt);
  child.stdin.end();
  // If the subprocess exits before reading stdin, writing emits EPIPE. Suppress
  // it here — child.on('close') will fire and call finishErr/finishOk normally.
  child.stdin.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code !== 'EPIPE') finishErr(`stdin write failed: ${e.message}`);
  });

  return () => {
    if (!child.killed) child.kill();
  };
}
