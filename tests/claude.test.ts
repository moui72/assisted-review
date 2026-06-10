import { splitSuggestedAction, buildPrompt } from '../src/claude';
import type { Chunk } from '../src/types';

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
