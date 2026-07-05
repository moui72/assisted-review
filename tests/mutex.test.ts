import { createMutex } from '../src/mutex';

describe('createMutex', () => {
  it('runs queued operations one at a time, in call order', async () => {
    const withLock = createMutex();
    const order: string[] = [];

    const p1 = withLock(async () => {
      order.push('1 start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('1 end');
      return 1;
    });
    const p2 = withLock(async () => {
      order.push('2 start');
      return 2;
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    // The second operation must not start until the first has fully
    // finished — this is exactly what stops a slower mutation's read from
    // racing ahead of a faster one's write (see api.md's concurrency risk).
    expect(order).toEqual(['1 start', '1 end', '2 start']);
  });

  it('keeps the queue moving even if an earlier operation rejects', async () => {
    const withLock = createMutex();
    const order: string[] = [];

    const p1 = withLock(async () => {
      throw new Error('boom');
    });
    const p2 = withLock(async () => {
      order.push('2 ran');
      return 'ok';
    });

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).resolves.toBe('ok');
    expect(order).toEqual(['2 ran']);
  });

  it('is a mutex per instance — two independent mutexes do not block each other', async () => {
    const withLockA = createMutex();
    const withLockB = createMutex();
    const order: string[] = [];

    const pA = withLockA(async () => {
      order.push('A start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('A end');
    });
    const pB = withLockB(async () => {
      order.push('B start');
      order.push('B end');
    });

    await Promise.all([pA, pB]);
    // B (a different mutex) runs to completion without waiting on A.
    expect(order).toEqual(['A start', 'B start', 'B end', 'A end']);
  });
});
