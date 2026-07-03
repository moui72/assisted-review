import { GitLabApiError, isRetryable, withRetry } from '../src/gitlab-rest';

describe('GitLabApiError / isRetryable', () => {
  it.each([400, 401, 403, 404, 422])(
    'treats status %i as non-retryable',
    (status) => {
      expect(isRetryable(new GitLabApiError('boom', status))).toBe(false);
    },
  );

  it.each([429, 500, 502, 503])(
    'treats status %i as retryable',
    (status) => {
      expect(isRetryable(new GitLabApiError('boom', status))).toBe(true);
    },
  );

  it('treats a GitLabApiError with no status as retryable (unknown — can\'t rule out transient)', () => {
    expect(isRetryable(new GitLabApiError('boom'))).toBe(true);
  });

  it('treats a plain Error (the glab CLI path, no structured status) as retryable', () => {
    expect(isRetryable(new Error('glab api foo: exit code 1'))).toBe(true);
  });
});

describe('withRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('succeeds on the first try with no delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('succeeds on the 2nd attempt after a 50ms delay', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GitLabApiError('boom', 500))
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('succeeds on the 3rd attempt after 50ms then 100ms delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GitLabApiError('boom', 500))
      .mockRejectedValueOnce(new GitLabApiError('boom', 500))
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('succeeds on the 4th attempt after 50ms, 100ms, then 150ms delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GitLabApiError('boom', 500))
      .mockRejectedValueOnce(new GitLabApiError('boom', 500))
      .mockRejectedValueOnce(new GitLabApiError('boom', 500))
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(150);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('fails after exhausting all 3 retries (4 total calls)', async () => {
    const err = new GitLabApiError('boom', 500);
    const fn = vi.fn().mockRejectedValue(err);
    const promise = withRetry(fn);
    // Swallow the eventual rejection so it doesn't surface as an unhandled
    // rejection while timers are still being advanced below.
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(150);
    await expect(promise).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('stops immediately on a non-retryable error — one call, no delay', async () => {
    const err = new GitLabApiError('boom', 404);
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
