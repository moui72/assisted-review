// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, createEvent } from '@testing-library/react';
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
    streamAi: vi.fn(() => vi.fn()),
    fetchInvestigationConfig: vi.fn(async () => ({
      platform: 'github',
      owner: 'alice',
      repo: 'proj',
      mode: 'none',
      chosen_at: '',
    })),
  };
});

import { fetchReview, fetchState, postAction, fetchInvestigationConfig, streamAi } from '../../web/src/api.ts';
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

describe('App — modifier combos pass through single-letter shortcuts', () => {
  it('does not preventDefault on ⌘/Ctrl + c/a/f, but bare c and a still act', async () => {
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockResolvedValue(initialState());

    render(<App />);
    // Wait until the app has loaded onto the Overview page (the global keydown
    // handler is only wired up once loaded).
    await waitFor(() => expect(screen.getByText('Displaced comments')).toBeInTheDocument());

    // ⌘/Ctrl + a single-letter shortcut must fall through to the browser's
    // native handler (⌘C copy, ⌘A select-all, ⌘F find) — every single-letter
    // branch is guarded by !mod. (metaKey+ctrlKey both set so `mod` is true on
    // either platform's IS_MAC branch.)
    for (const key of ['c', 'a', 'f']) {
      const modified = createEvent.keyDown(window, { key, ctrlKey: true, metaKey: true });
      fireEvent(window, modified);
      expect(modified.defaultPrevented).toBe(false);
    }

    // Bare `c` (focus comment) and `a` (focus ask) still act — preventDefault'd.
    for (const key of ['c', 'a']) {
      const bare = createEvent.keyDown(window, { key });
      fireEvent(window, bare);
      expect(bare.defaultPrevented).toBe(true);
    }
  });
});

describe('App — investigation access banner', () => {
  it('shows the banner when the repo has no investigation config yet, and opens the modal on click', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(fetchInvestigationConfig).mockResolvedValue({
      platform: 'github',
      owner: 'alice',
      repo: 'proj',
      mode: 'none',
      chosen_at: '',
    });

    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/Enable deeper investigation/)).toBeInTheDocument(),
    );

    await user.click(screen.getByText(/Enable deeper investigation/));
    expect(screen.getByText('Diff only (default)')).toBeInTheDocument();
  });

  it('does not show the banner once a mode has been chosen', async () => {
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(fetchInvestigationConfig).mockResolvedValue({
      platform: 'github',
      owner: 'alice',
      repo: 'proj',
      mode: 'api',
      chosen_at: '2026-01-01T00:00:00.000Z',
    });

    render(<App />);
    await waitFor(() => expect(fetchInvestigationConfig).toHaveBeenCalled());
    expect(screen.queryByText(/Enable deeper investigation/)).not.toBeInTheDocument();
  });

  it('dismissing the banner hides it', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(fetchInvestigationConfig).mockResolvedValue({
      platform: 'github',
      owner: 'alice',
      repo: 'proj',
      mode: 'none',
      chosen_at: '',
    });

    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/Enable deeper investigation/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Enable deeper investigation/)).not.toBeInTheDocument();
  });

  it('suppresses global keyboard shortcuts while open, and Escape closes it', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(fetchInvestigationConfig).mockResolvedValue({
      platform: 'github',
      owner: 'alice',
      repo: 'proj',
      mode: 'none',
      chosen_at: '',
    });

    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/Enable deeper investigation/)).toBeInTheDocument(),
    );
    await user.click(screen.getByText(/Enable deeper investigation/));
    expect(screen.getByText('Diff only (default)')).toBeInTheDocument();

    // Still on the Overview page — ArrowRight normally navigates into the
    // first chunk, which would unmount this text. It must not fire while
    // the modal is open.
    expect(screen.getByText(/chunks one at a time/)).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText(/chunks one at a time/)).toBeInTheDocument();
    expect(screen.getByText('Diff only (default)')).toBeInTheDocument();

    // Escape closes the modal via the global handler.
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Diff only (default)')).not.toBeInTheDocument();
  });
});

describe('App — AI note regeneration', () => {
  it('deletes the persisted initial note and starts a replacement stream for the same target', async () => {
    const user = userEvent.setup();
    const stateWithSummary: ReviewState = {
      ...initialState(),
      notes: [
        {
          id: 'n1',
          chunk_id: '__overview__',
          kind: 'initial',
          body: 'Existing summary',
          created_at: 't',
          updated_at: 't',
        },
      ],
    };
    const stateAfterDelete: ReviewState = { ...stateWithSummary, notes: [] };

    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => stateWithSummary);
    vi.mocked(postAction).mockResolvedValue(stateAfterDelete);
    vi.mocked(streamAi).mockClear();

    render(<App />);

    await waitFor(() => expect(screen.getByText('Existing summary')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'regenerate' }));

    await waitFor(() =>
      expect(postAction).toHaveBeenCalledWith({ type: 'delete_note', id: 'n1' }),
    );
    expect(streamAi).toHaveBeenCalledWith(
      { chunkId: '__overview__', question: '' },
      expect.anything(),
    );
  });
});
