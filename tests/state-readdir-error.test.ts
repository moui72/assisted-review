// Tests the listReviews outer-catch path — when readdir itself throws (e.g. dir missing).
// Isolated in its own file because vi.mock('node:fs/promises') affects all imports.

import { vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readdir: vi.fn() };
});

import { readdir } from 'node:fs/promises';
import { listReviews } from '../src/state';

describe('listReviews — readdir failure', () => {
  it('returns [] when the state directory cannot be read', async () => {
    vi.mocked(readdir).mockRejectedValueOnce(new Error('ENOENT'));
    const result = await listReviews();
    expect(result).toEqual([]);
  });
});
