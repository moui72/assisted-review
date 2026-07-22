import { tmpdir } from 'node:os';

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
