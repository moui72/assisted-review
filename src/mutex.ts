// A tiny FIFO async mutex: queues async operations so only one runs at a
// time, in call order, regardless of how long each takes or whether it
// rejects. Used by server.ts to serialize mutations to the in-memory review
// state (ctx.state) so overlapping requests can't race — see api.md's
// Production Annotations.

export function createMutex() {
  let queue: Promise<unknown> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn, fn);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
