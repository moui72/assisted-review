import { GitLabApiError, isRetryable } from '../src/gitlab-rest';

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
