import { parseRef } from '../src/parse-ref';

describe('parseRef', () => {
  it('parses owner/repo#123 short form', () => {
    const ref = parseRef('octocat/hello#123');
    expect(ref).toEqual({ owner: 'octocat', repo: 'hello', number: 123 });
  });

  it('parses a full GitHub PR URL', () => {
    const ref = parseRef('https://github.com/o/r/pull/7');
    expect(ref).toEqual({ owner: 'o', repo: 'r', number: 7 });
  });

  it('parses a URL with a trailing slash and extra path segments', () => {
    const ref = parseRef('https://github.com/o/r/pull/7/files');
    expect(ref).toEqual({ owner: 'o', repo: 'r', number: 7 });
  });

  it('trims leading and trailing whitespace', () => {
    const ref = parseRef('  octocat/hello#42  ');
    expect(ref).toEqual({ owner: 'octocat', repo: 'hello', number: 42 });
  });

  it('returns number as a real number, not a string', () => {
    const ref = parseRef('o/r#99');
    expect(typeof ref.number).toBe('number');
    expect(ref.number).toBe(99);
  });

  it('handles repo names containing dots', () => {
    const ref = parseRef('my-org/my.repo.name#5');
    expect(ref).toEqual({ owner: 'my-org', repo: 'my.repo.name', number: 5 });
  });

  it('throws on a non-numeric PR number', () => {
    expect(() => parseRef('o/r#abc')).toThrow(/unrecognized PR reference/);
  });

  it('throws on a garbage string', () => {
    expect(() => parseRef('not a ref at all')).toThrow(
      /unrecognized PR reference/,
    );
  });

  it('throws on an empty string', () => {
    expect(() => parseRef('')).toThrow(/missing PR reference/);
  });

  it('throws on undefined', () => {
    expect(() => parseRef(undefined)).toThrow(/missing PR reference/);
  });
});
