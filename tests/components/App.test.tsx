// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Action, Review, ReviewState } from '../../web/src/api.ts';

// jsdom doesn't drive framer-motion's real exit-animation timing, which
// leaves AnimatePresence's exiting page mounted indefinitely and produces
// duplicate matches once ChunkView/OverviewView swap. Render page swaps
// instantly instead — this test cares about state/dispatch wiring, not
// the transition animation itself.
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));

vi.mock('../../web/src/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../web/src/api.ts')>();
  return {
    ...actual,
    fetchConfig: vi.fn(async () => ({ preload_chunks: 0, preload_overview: false })),
    fetchReview: vi.fn(),
    fetchState: vi.fn(),
    postAction: vi.fn(),
  };
});

import { fetchReview, fetchState, postAction } from '../../web/src/api.ts';
import { App } from '../../web/src/App.tsx';

const pr = { owner: 'alice', repo: 'proj', number: 1, platform: 'github' as const };

const meta = {
  title: 'Add feature',
  author: 'alice',
  base_ref: 'main',
  head_ref: 'feature',
  is_draft: false,
  url: 'https://github.com/alice/proj/pull/1',
  head_sha: 'abc123',
  body: '',
};

const chunk = {
  id: 'c1',
  file: 'a.ts',
  hunk_header: '@@ -1,3 +1,3 @@',
  old_range: [1, 3] as [number, number],
  new_range: [1, 3] as [number, number],
  context: '',
  diff: '@@ -1,3 +1,3 @@\n context line\n-old line\n+new line\n',
  members: [],
};

const review: Review = {
  pr,
  meta,
  chunks: [chunk],
  overview: { jira: { available: false, keys: [], issues: [] } },
  generated_at: new Date().toISOString(),
};

const displacedComment = {
  id: 'cm1',
  chunk_id: 'stale-id',
  side: 'RIGHT' as const,
  line: 1,
  body: 'still relevant?',
  file: 'a.ts',
  hunk_header: '@@ -1,3 +1,3 @@',
  displaced: true,
  created_at: 't',
  updated_at: 't',
};

function initialState(): ReviewState {
  return {
    version: 2,
    pr,
    head_sha: 'abc123',
    started_at: '2020-01-01T00:00:00.000Z',
    comments: [displacedComment],
    flagged: [],
    viewed: [],
    notes: [],
  };
}

describe('App — displaced comment re-anchoring', () => {
  it('re-anchors a displaced comment end-to-end: shows it on Overview, dispatches reanchor_comment on line pick, and it no longer appears once resolved', async () => {
    const user = userEvent.setup();
    let currentState = initialState();

    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => currentState);
    vi.mocked(postAction).mockImplementation(async (action: Action) => {
      if (action.type === 'reanchor_comment') {
        currentState = {
          ...currentState,
          comments: currentState.comments.map((c) =>
            c.id === action.id
              ? {
                  ...c,
                  chunk_id: action.chunk_id,
                  side: action.side,
                  line: action.line,
                  file: action.file,
                  hunk_header: action.hunk_header,
                  displaced: false,
                }
              : c,
          ),
        };
      }
      return currentState;
    });

    render(<App />);

    // Loads on the Overview page — the displaced comment shows there with a
    // Re-anchor button, since it has no current chunk to attach to.
    await waitFor(() => expect(screen.getByText('Displaced comments')).toBeInTheDocument());
    expect(screen.getByText('still relevant?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /re-anchor/i }));

    // Entering re-anchor mode jumps into ChunkView and swaps ResponseBar into
    // its re-anchoring display.
    await waitFor(() => expect(screen.getByText('re-anchoring comment')).toBeInTheDocument());

    // Click a diff line to place the comment.
    const rows = document.querySelectorAll('tr.cursor-pointer');
    expect(rows.length).toBeGreaterThan(0);
    await user.click(rows[0]);

    await waitFor(() =>
      expect(vi.mocked(postAction)).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reanchor_comment',
          id: 'cm1',
          chunk_id: 'c1',
          file: 'a.ts',
          hunk_header: '@@ -1,3 +1,3 @@',
        }),
      ),
    );

    // Re-anchoring mode clears and the comment now renders inline in the
    // chunk instead of the Displaced Comments section.
    await waitFor(() => expect(screen.queryByText('re-anchoring comment')).not.toBeInTheDocument());
    expect(screen.getByText('still relevant?')).toBeInTheDocument();

    // Back on Overview, the comment is gone from Displaced Comments.
    await user.click(screen.getByRole('button', { name: 'Overview' }));
    await waitFor(() => expect(screen.queryByText('Displaced comments')).not.toBeInTheDocument());
  });
});
