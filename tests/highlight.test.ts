import { langFor, highlightLine } from '../web/src/highlight.ts';

describe('langFor', () => {
  it('resolves foo.ts to typescript', () => {
    expect(langFor('foo.ts')).toBe('typescript');
  });

  it('resolves a path a/b.yaml to yaml', () => {
    expect(langFor('a/b.yaml')).toBe('yaml');
  });

  it('resolves x.tftpl to yaml', () => {
    expect(langFor('x.tftpl')).toBe('yaml');
  });

  it('resolves main.tf to terraform', () => {
    expect(langFor('main.tf')).toBe('terraform');
  });

  it('resolves Dockerfile (no extension) to dockerfile', () => {
    expect(langFor('Dockerfile')).toBe('dockerfile');
  });

  it('returns null for an unknown extension', () => {
    expect(langFor('archive.xyz')).toBeNull();
  });

  it('returns null for a file with no extension', () => {
    expect(langFor('LICENSE')).toBeNull();
  });

  it('is case-insensitive (FOO.TS -> typescript)', () => {
    expect(langFor('FOO.TS')).toBe('typescript');
  });
});

describe('highlightLine', () => {
  it('returns empty string for empty input', () => {
    expect(highlightLine('', 'typescript')).toBe('');
  });

  it('HTML-escapes <, > and & when lang is null', () => {
    expect(highlightLine('a < b && c > d', null)).toBe(
      'a &lt; b &amp;&amp; c &gt; d',
    );
  });

  it('returns highlighted HTML with an hljs- class for a known language', () => {
    const out = highlightLine('const x = 1;', 'typescript');
    expect(out).toContain('hljs-');
  });

  it('does not throw on input that does not fully parse', () => {
    expect(() => highlightLine('const ( ] unterminated', 'typescript')).not.toThrow();
  });

  it('falls back to HTML-escaped output when hljs throws (unknown language)', () => {
    // hljs throws for unknown language names; the catch block returns escaped plain text.
    const result = highlightLine('a < b', '__not_a_real_language__');
    expect(result).toBe('a &lt; b');
  });
});
