import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export async function resolvePkg(): Promise<{ name: string; version: string }> {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(
    await readFile(join(here, '..', 'package.json'), 'utf8'),
  ) as { name: string; version: string };
}
