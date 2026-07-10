// @vitest-environment jsdom
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AiCommentary } from '../../web/src/components/AiCommentary.tsx';
import type { StoredNote } from '../../web/src/api.ts';

const note: StoredNote = {
  id: 'n1',
  chunk_id: 'c1',
  kind: 'initial',
  body: 'This is **bold**, some `inline code`, and:\n\n```js\nconst x = 1;\n```\n\n- item one\n- item two',
  created_at: '2026-07-10T00:00:00Z',
};

describe('AiCommentary', () => {
  it('renders markdown in a note body as formatted elements, not raw source', () => {
    const { container } = render(
      <AiCommentary
        notes={[note]}
        deletableNoteIds={new Set()}
        streaming={null}
        busy={false}
        error={null}
        askRef={createRef<HTMLInputElement>()}
        onAsk={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(container.querySelector('code')).not.toBeNull();
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.textContent).not.toContain('**bold**');
  });
});
