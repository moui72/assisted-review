// Resolve a JIRA_TOKEN value that may be a reference rather than a raw secret.
//
// Supported formats:
//   op://vault/item/field   1Password — requires `op` CLI
//   env:VAR_NAME            value of the named environment variable
//   cmd:<shell command>     stdout of the command (safe since .env is 0600)
//   <anything else>         treated as a raw token

import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

async function runOp(ref: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('op', ['read', ref], { timeout: 8000 });
    return stdout.trim();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      throw new Error('`op` CLI not found — install the 1Password CLI to use op:// references');
    }
    throw new Error(`op read failed: ${(e as Error).message}`);
  }
}

async function runShell(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    return stdout.trim();
  } catch (err) {
    throw new Error(`cmd failed: ${(err as Error).message}`);
  }
}

export function isReference(ref: string): boolean {
  return ref.startsWith('op://') || ref.startsWith('env:') || ref.startsWith('cmd:');
}

export async function resolveToken(ref: string): Promise<string> {
  if (!ref) return '';

  if (ref.startsWith('op://')) {
    return runOp(ref);
  }

  if (ref.startsWith('env:')) {
    const name = ref.slice(4).trim();
    const val = process.env[name];
    if (!val) throw new Error(`env var ${name} is not set`);
    return val;
  }

  if (ref.startsWith('cmd:')) {
    return runShell(ref.slice(4).trim());
  }

  return ref;
}
