import { readFile } from 'node:fs/promises';
import { resolvePkg } from '../src/pkg-info';

describe('resolvePkg', () => {
  it('resolves name/version matching package.json', async () => {
    const pkg = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { name: string; version: string };

    await expect(resolvePkg()).resolves.toMatchObject({
      name: pkg.name,
      version: pkg.version,
    });
  });
});
