import { parseDiff, groupChunks, chunksFromDiff } from '../src/parse-diff';

// Silence the parse-diff warnings (console.error) during tests.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('parseDiff', () => {
  it('parses a single hunk', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      'index 111..222 100644',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,3 +1,4 @@ function foo() {',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      '+const c = 4;',
      ' return a;',
    ].join('\n');

    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(1);
    const h = hunks[0];
    expect(h.id).toBe('c1');
    expect(h.file).toBe('src/foo.ts');
    expect(h.old_range).toEqual([1, 3]);
    expect(h.new_range).toEqual([1, 4]);
    expect(h.context).toBe('function foo() {');
    expect(h.hunk_header).toBe('@@ -1,3 +1,4 @@ function foo() {');
    // diff is the header + body joined by newlines.
    expect(h.diff).toBe(
      [
        '@@ -1,3 +1,4 @@ function foo() {',
        ' const a = 1;',
        '-const b = 2;',
        '+const b = 3;',
        '+const c = 4;',
        ' return a;',
      ].join('\n'),
    );
  });

  it('groupChunks wraps a single hunk in one member', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');
    const chunks = chunksFromDiff(diff);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].members).toHaveLength(1);
    expect(chunks[0].context).toBe('');
  });

  it('new file (--- /dev/null) gives old_range [0,0]', () => {
    const diff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1,2 @@',
      '+line one',
      '+line two',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe('new.ts');
    expect(hunks[0].old_range).toEqual([0, 0]);
    expect(hunks[0].new_range).toEqual([1, 2]);
  });

  it('deleted file (+++ /dev/null) gives new_range [0,0]', () => {
    const diff = [
      'diff --git a/gone.ts b/gone.ts',
      'deleted file mode 100644',
      '--- a/gone.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-line one',
      '-line two',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe('gone.ts');
    expect(hunks[0].old_range).toEqual([1, 2]);
    expect(hunks[0].new_range).toEqual([0, 0]);
  });

  it('omitted hunk counts default to 1', () => {
    const diff = [
      'diff --git a/f.ts b/f.ts',
      '--- a/f.ts',
      '+++ b/f.ts',
      '@@ -5 +5 @@',
      '-x',
      '+y',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].old_range).toEqual([5, 5]);
    expect(hunks[0].new_range).toEqual([5, 5]);
  });

  it('zero-count hunk @@ -1,0 +1,0 @@ gives [start,start]', () => {
    const diff = [
      'diff --git a/f.ts b/f.ts',
      '--- a/f.ts',
      '+++ b/f.ts',
      '@@ -1,0 +1,0 @@',
      ' context',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].old_range).toEqual([1, 1]);
    expect(hunks[0].new_range).toEqual([1, 1]);
  });

  it('a pure rename with no hunk produces zero chunks', () => {
    const diff = [
      'diff --git a/old-name.ts b/new-name.ts',
      'similarity index 100%',
      'rename from old-name.ts',
      'rename to new-name.ts',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(0);
  });

  it('a binary file is skipped', () => {
    const diff = [
      'diff --git a/img.png b/img.png',
      'index 111..222 100644',
      'Binary files a/img.png and b/img.png differ',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(0);
  });

  it('multiple files get ids c1, c2... with correct paths', () => {
    const diff = [
      'diff --git a/first.ts b/first.ts',
      '--- a/first.ts',
      '+++ b/first.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      'diff --git a/second.ts b/second.ts',
      '--- a/second.ts',
      '+++ b/second.ts',
      '@@ -1,1 +1,1 @@',
      '-c',
      '+d',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].id).toBe('c1');
    expect(hunks[0].file).toBe('first.ts');
    expect(hunks[1].id).toBe('c2');
    expect(hunks[1].file).toBe('second.ts');
  });

  it('handles two hunks in the same file', () => {
    const diff = [
      'diff --git a/f.ts b/f.ts',
      '--- a/f.ts',
      '+++ b/f.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      '@@ -50,1 +50,1 @@',
      '-c',
      '+d',
    ].join('\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].id).toBe('c1');
    expect(hunks[1].id).toBe('c2');
    expect(hunks.every((h) => h.file === 'f.ts')).toBe(true);
  });

  it('does not leave \\r in the stored diff/body for CRLF input', () => {
    const diff = [
      'diff --git a/f.ts b/f.ts',
      '--- a/f.ts',
      '+++ b/f.ts',
      '@@ -1,1 +1,1 @@ ctx',
      '-old',
      '+new',
    ].join('\r\n');
    const hunks = parseDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].diff).not.toContain('\r');
    expect(hunks[0].hunk_header).not.toContain('\r');
    expect(hunks[0].context).toBe('ctx');
    expect(hunks[0].diff).toBe('@@ -1,1 +1,1 @@ ctx\n-old\n+new');
  });
});

describe('groupChunks', () => {
  const sameFileDiff = (gap: number) =>
    [
      'diff --git a/f.ts b/f.ts',
      '--- a/f.ts',
      '+++ b/f.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      `@@ -${gap},1 +${gap},1 @@`,
      '-c',
      '+d',
    ].join('\n');

  it('merges two adjacent same-file hunks separated by <= 20 lines into one group', () => {
    // second hunk starts at new line 5; prev ends at 1; gap = 5-1-1 = 3 <= 20.
    const hunks = parseDiff(sameFileDiff(5));
    expect(hunks).toHaveLength(2);
    const groups = groupChunks(hunks, 20);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.members).toHaveLength(2);
    // range spans from first hunk start to last hunk end.
    expect(g.new_range).toEqual([1, 5]);
    expect(g.old_range).toEqual([1, 5]);
    // diffs concatenated with a newline.
    expect(g.diff).toContain('@@ -1,1 +1,1 @@');
    expect(g.diff).toContain('@@ -5,1 +5,1 @@');
    expect(g.diff).toBe(`${hunks[0].diff}\n${hunks[1].diff}`);
  });

  it('keeps a gap > 20 as two separate groups', () => {
    // second hunk starts at new line 100; gap = 100-1-1 = 98 > 20.
    const hunks = parseDiff(sameFileDiff(100));
    const groups = groupChunks(hunks, 20);
    expect(groups).toHaveLength(2);
    expect(groups[0].members).toHaveLength(1);
    expect(groups[1].members).toHaveLength(1);
  });

  it('never merges hunks from different files', () => {
    const diff = [
      'diff --git a/one.ts b/one.ts',
      '--- a/one.ts',
      '+++ b/one.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
      'diff --git a/two.ts b/two.ts',
      '--- a/two.ts',
      '+++ b/two.ts',
      '@@ -1,1 +1,1 @@',
      '-c',
      '+d',
    ].join('\n');
    const groups = groupChunks(parseDiff(diff), 20);
    expect(groups).toHaveLength(2);
    expect(groups[0].file).toBe('one.ts');
    expect(groups[1].file).toBe('two.ts');
  });

  it('gap=0 disables all merging', () => {
    const hunks = parseDiff(sameFileDiff(5));
    const groups = groupChunks(hunks, 0);
    expect(groups).toHaveLength(2);
  });

  it('returns an empty array for no chunks', () => {
    expect(groupChunks([], 20)).toEqual([]);
  });
});
