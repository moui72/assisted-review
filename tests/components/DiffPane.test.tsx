// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { DiffPane } from '../../web/src/components/DiffPane.tsx';
import type { Chunk, DraftComment } from '../../web/src/api.ts';

const chunk: Chunk = {
  id: 'c1',
  file: 'src/foo.ts',
  hunk_header: '@@ -1,1 +1,1 @@',
  old_range: [1, 1],
  new_range: [1, 1],
  context: '',
  diff: '@@ -1,1 +1,1 @@\n+added line',
  members: [],
};

const comment: DraftComment = {
  id: 'comment-1',
  chunk_id: 'c1',
  side: 'RIGHT',
  line: 1,
  body: 'original body',
  file: 'src/foo.ts',
  hunk_header: '@@ -1,1 +1,1 @@',
  displaced: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function renderDiffPane(overrides: Partial<DraftComment> = {}) {
  const onDeleteComment = vi.fn();
  const onUpdateComment = vi.fn();
  render(
    <DiffPane
      chunk={chunk}
      comments={[{ ...comment, ...overrides }]}
      anchor={null}
      onSelectLine={vi.fn()}
      onDeleteComment={onDeleteComment}
      onUpdateComment={onUpdateComment}
    />,
  );
  return { onDeleteComment, onUpdateComment };
}

describe('DiffPane CommentCard editing', () => {
  it('enters edit mode with a textarea prefilled with the comment body', async () => {
    renderDiffPane();
    await userEvent.click(screen.getByText('edit'));
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('original body');
  });

  it('save calls onUpdateComment with the id and edited body, then exits edit mode', async () => {
    const { onUpdateComment } = renderDiffPane();
    await userEvent.click(screen.getByText('edit'));
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'edited body');
    await userEvent.click(screen.getByText('save'));

    expect(onUpdateComment).toHaveBeenCalledWith('comment-1', 'edited body');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('cancel discards the change with no onUpdateComment call and restores the original body', async () => {
    const { onUpdateComment } = renderDiffPane();
    await userEvent.click(screen.getByText('edit'));
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'discarded');
    await userEvent.click(screen.getByText('cancel'));

    expect(onUpdateComment).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('original body')).toBeInTheDocument();
  });

  it('Escape in the textarea behaves the same as cancel', async () => {
    const { onUpdateComment } = renderDiffPane();
    await userEvent.click(screen.getByText('edit'));
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'discarded via escape');
    await userEvent.keyboard('{Escape}');

    expect(onUpdateComment).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('original body')).toBeInTheDocument();
  });

  it('disables save when the body is cleared to empty/whitespace-only', async () => {
    renderDiffPane();
    await userEvent.click(screen.getByText('edit'));
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, '   ');

    expect(screen.getByText('save')).toBeDisabled();
  });
});
