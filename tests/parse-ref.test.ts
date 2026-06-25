import { parseRef } from '../src/parse-ref';

describe('parseRef — GitHub', () => {
  it('parses owner/repo#123 short form', () => {
    const ref = parseRef('octocat/hello#123');
    expect(ref).toEqual({ owner: 'octocat', repo: 'hello', number: 123, platform: 'github' });
  });

  it('parses a full GitHub PR URL', () => {
    const ref = parseRef('https://github.com/o/r/pull/7');
    expect(ref).toEqual({ owner: 'o', repo: 'r', number: 7, platform: 'github' });
  });

  it('parses a URL with a trailing slash and extra path segments', () => {
    const ref = parseRef('https://github.com/o/r/pull/7/files');
    expect(ref).toEqual({ owner: 'o', repo: 'r', number: 7, platform: 'github' });
  });

  it('trims leading and trailing whitespace', () => {
    const ref = parseRef('  octocat/hello#42  ');
    expect(ref).toEqual({ owner: 'octocat', repo: 'hello', number: 42, platform: 'github' });
  });

  it('returns number as a real number, not a string', () => {
    const ref = parseRef('o/r#99');
    expect(typeof ref.number).toBe('number');
    expect(ref.number).toBe(99);
  });

  it('handles repo names containing dots', () => {
    const ref = parseRef('my-org/my.repo.name#5');
    expect(ref).toEqual({ owner: 'my-org', repo: 'my.repo.name', number: 5, platform: 'github' });
  });

  it('throws on a non-numeric PR number', () => {
    expect(() => parseRef('o/r#abc')).toThrow(/unrecognized PR reference/);
  });

  it('throws on a garbage string', () => {
    expect(() => parseRef('not a ref at all')).toThrow(/unrecognized PR reference/);
  });

  it('throws on an empty string', () => {
    expect(() => parseRef('')).toThrow(/missing PR reference/);
  });

  it('throws on undefined', () => {
    expect(() => parseRef(undefined)).toThrow(/missing PR reference/);
  });
});

describe('parseRef — GitLab shorthand', () => {
  it('parses owner/repo!123 short form', () => {
    const ref = parseRef('octocat/hello!123');
    expect(ref).toEqual({ owner: 'octocat', repo: 'hello', number: 123, platform: 'gitlab' });
  });

  it('parses nested namespace/repo!123', () => {
    const ref = parseRef('mygroup/subteam/myrepo!42');
    expect(ref).toEqual({ owner: 'mygroup/subteam', repo: 'myrepo', number: 42, platform: 'gitlab' });
  });

  it('parses deeply nested namespace', () => {
    const ref = parseRef('a/b/c/repo!7');
    expect(ref).toEqual({ owner: 'a/b/c', repo: 'repo', number: 7, platform: 'gitlab' });
  });

  it('trims whitespace', () => {
    const ref = parseRef('  group/repo!5  ');
    expect(ref).toEqual({ owner: 'group', repo: 'repo', number: 5, platform: 'gitlab' });
  });
});

describe('parseRef — GitLab URL', () => {
  it('parses a gitlab.com MR URL', () => {
    const ref = parseRef('https://gitlab.com/mygroup/myrepo/-/merge_requests/99');
    expect(ref).toEqual({ owner: 'mygroup', repo: 'myrepo', number: 99, platform: 'gitlab' });
  });

  it('parses a nested namespace GitLab URL', () => {
    const ref = parseRef('https://gitlab.com/group/subgroup/repo/-/merge_requests/3');
    expect(ref).toEqual({ owner: 'group/subgroup', repo: 'repo', number: 3, platform: 'gitlab' });
  });

  it('parses a deeply nested GitLab URL', () => {
    const ref = parseRef('https://gitlab.com/a/b/c/repo/-/merge_requests/10');
    expect(ref).toEqual({ owner: 'a/b/c', repo: 'repo', number: 10, platform: 'gitlab' });
  });

  it('handles extra path after the MR number', () => {
    const ref = parseRef('https://gitlab.com/group/repo/-/merge_requests/5/diffs');
    expect(ref).toEqual({ owner: 'group', repo: 'repo', number: 5, platform: 'gitlab' });
  });

  it('throws on a GitLab URL with no namespace (no slash before repo)', () => {
    expect(() => parseRef('https://gitlab.com/repo/-/merge_requests/5')).toThrow(/unrecognized GitLab URL/);
  });
});
