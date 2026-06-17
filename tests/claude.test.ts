import { splitSuggestedAction, buildPrompt, buildOverviewPrompt } from '../src/claude';
import type { Chunk, JiraContext, PrMeta } from '../src/types';

describe('splitSuggestedAction', () => {
  it('splits a trailing "Suggested action:" line from the body', () => {
    const text =
      'Zero is falsy, so guards may treat the cohort as absent.\n\nSuggested action: ask the author whether the key should be non-zero.';
    const { body, suggestedAction } = splitSuggestedAction(text);
    expect(body).toBe('Zero is falsy, so guards may treat the cohort as absent.');
    expect(suggestedAction).toBe('ask the author whether the key should be non-zero.');
  });

  it('tolerates markdown bold around the label', () => {
    const { body, suggestedAction } = splitSuggestedAction(
      'Body here.\n**Suggested action:** verify the type.',
    );
    expect(body).toBe('Body here.');
    expect(suggestedAction).toBe('verify the type.');
  });

  it('is case-insensitive', () => {
    const { suggestedAction } = splitSuggestedAction('Body.\n\nsuggested ACTION: do the thing.');
    expect(suggestedAction).toBe('do the thing.');
  });

  it('returns no action when the marker is absent', () => {
    const { body, suggestedAction } = splitSuggestedAction('Just an observation, no action.');
    expect(body).toBe('Just an observation, no action.');
    expect(suggestedAction).toBeUndefined();
  });

  it('returns no action when the marker has an empty tail', () => {
    const { suggestedAction } = splitSuggestedAction('Body.\nSuggested action:   ');
    expect(suggestedAction).toBeUndefined();
  });
});

describe('buildPrompt', () => {
  const chunk = {
    id: 'c1',
    file: 'src/foo.ts',
    diff: '@@ -1 +1 @@\n-a\n+b',
  } as Chunk;

  it('asks for a suggested action on the initial note', () => {
    const p = buildPrompt(chunk, 'initial', '');
    expect(p).toMatch(/Suggested action:/);
    expect(p).toContain('src/foo.ts');
    expect(p).toContain('+b');
  });

  it('embeds the question for an investigation and omits the action format', () => {
    const p = buildPrompt(chunk, 'investigation', 'why rename b?');
    expect(p).toContain('why rename b?');
    expect(p).not.toMatch(/Suggested action:/);
  });
});

describe('splitSuggestedAction — body cleaning', () => {
  it('strips a leading enumerator ("1. ") from the body', () => {
    const { body } = splitSuggestedAction('1. An observation.');
    expect(body).toBe('An observation.');
  });
});

describe('buildOverviewPrompt', () => {
  const meta: PrMeta = {
    title: 'Add feature X',
    author: 'alice',
    base_ref: 'main',
    head_ref: 'feat/x',
    is_draft: false,
    url: 'https://github.com/example/repo/pull/1',
    head_sha: 'abc123',
    body: '',
  };

  const chunk: Chunk = {
    id: 'c1',
    file: 'src/foo.ts',
    hunk_header: '@@ -1,1 +1,1 @@',
    old_range: [1, 1],
    new_range: [1, 1],
    context: '',
    diff: '@@ -1,1 +1,1 @@\n-a\n+b',
    members: [],
  };

  const noJira: JiraContext = { available: false, keys: [], issues: [] };

  it('without a question asks to orient the reviewer', () => {
    const p = buildOverviewPrompt(meta, [chunk], noJira, '');
    expect(p).toContain('orient the reviewer');
    expect(p).toContain('Add feature X');
    expect(p).toContain('src/foo.ts');
    expect(p).not.toContain('PR description:');
  });

  it('with a question asks to answer it', () => {
    const p = buildOverviewPrompt(meta, [chunk], noJira, 'what does this do?');
    expect(p).toContain('what does this do?');
    expect(p).not.toContain('orient the reviewer');
  });

  it('includes PR body when non-empty', () => {
    const m = { ...meta, body: 'Fixes bug #123' };
    const p = buildOverviewPrompt(m, [chunk], noJira, '');
    expect(p).toContain('PR description:');
    expect(p).toContain('Fixes bug #123');
  });

  it('includes Jira issues when available', () => {
    const jira: JiraContext = {
      available: true,
      keys: ['PROJ-1'],
      issues: [
        {
          key: 'PROJ-1',
          summary: 'Do the thing',
          status: 'In Progress',
          type: 'Story',
          description: 'Details here',
          url: 'https://jira.example.com/PROJ-1',
        },
      ],
    };
    const p = buildOverviewPrompt(meta, [chunk], jira, '');
    expect(p).toContain('PROJ-1');
    expect(p).toContain('Do the thing');
  });

  it('includes Jira epic when present', () => {
    const jira: JiraContext = {
      available: true,
      keys: ['PROJ-1'],
      issues: [
        {
          key: 'PROJ-1',
          summary: 'A story',
          status: 'Open',
          type: 'Story',
          description: '',
          url: '',
        },
      ],
      epic: {
        key: 'EPIC-1',
        summary: 'The epic',
        status: 'Open',
        type: 'Epic',
        description: 'Epic details',
        url: '',
      },
    };
    const p = buildOverviewPrompt(meta, [chunk], jira, '');
    expect(p).toContain('EPIC-1');
    expect(p).toContain('The epic');
  });

  it('skips Jira block when available but no issues', () => {
    const jira: JiraContext = { available: true, keys: [], issues: [] };
    const p = buildOverviewPrompt(meta, [chunk], jira, '');
    expect(p).not.toContain('Linked Jira');
  });

  it('clips very long diffs and marks them truncated', () => {
    const bigChunk: Chunk = { ...chunk, diff: '+' + 'x'.repeat(13000) };
    const p = buildOverviewPrompt(meta, [bigChunk], noJira, '');
    expect(p).toContain('(truncated)');
  });

  it('deduplicates file names in the files-changed line', () => {
    const c2: Chunk = { ...chunk, id: 'c2' }; // same file
    const p = buildOverviewPrompt(meta, [chunk, c2], noJira, '');
    const m = p.match(/Files changed \((\d+)\)/);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('1'); // deduped to one unique file
  });
});
