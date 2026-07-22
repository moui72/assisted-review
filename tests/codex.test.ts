import { tmpdir } from 'node:os';
import { buildCodexExecArgs } from '../src/codex';

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
