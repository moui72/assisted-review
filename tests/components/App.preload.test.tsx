// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Review, ReviewState } from '../../web/src/api.ts';

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
    fetchConfig: vi.fn(async () => ({ preload_chunks: 1, preload_overview: true })),
    fetchReview: vi.fn(),
    fetchState: vi.fn(),
    postAction: vi.fn(),
    streamAi: vi.fn(() => vi.fn()),
  };
});

import { fetchReview, fetchState, streamAi } from '../../web/src/api.ts';
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

const chunk1 = {
  id: 'c1',
  file: 'a.ts',
  hunk_header: '@@ -1,3 +1,3 @@',
  old_range: [1, 3] as [number, number],
  new_range: [1, 3] as [number, number],
  context: '',
  diff: '@@ -1,3 +1,3 @@\n context line\n-old line\n+new line\n',
  members: [],
};

const chunk2 = {
  id: 'c2',
  file: 'b.ts',
  hunk_header: '@@ -1,2 +1,2 @@',
  old_range: [1, 2] as [number, number],
  new_range: [1, 2] as [number, number],
  context: '',
  diff: '@@ -1,2 +1,2 @@\n context\n-old\n+new\n',
  members: [],
};

const review: Review = {
  pr,
  meta,
  chunks: [chunk1, chunk2],
  overview: { jira: { available: false, keys: [], issues: [] } },
  generated_at: new Date().toISOString(),
};

function initialState(): ReviewState {
  return {
    version: 2,
    pr,
    head_sha: 'abc123',
    started_at: '2020-01-01T00:00:00.000Z',
    comments: [],
    flagged: [],
    viewed: [],
    notes: [],
  };
}

describe('App — preload loading state', () => {
  it('shows busy (disabled Summarize/input) while the overview preload is in flight, and clears it on completion', async () => {
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(streamAi).mockClear();

    render(<App />);

    await waitFor(() => expect(vi.mocked(streamAi)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(streamAi).mock.calls[0][0]).toEqual(
      expect.objectContaining({ chunkId: '__overview__' }),
    );

    // Busy: the ask input is disabled, and neither the idle "Summarize this
    // PR" button nor a "regenerate" button render (Summary's busy branch
    // shows only the pulsing-cursor treatment).
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Ask about this PR… (a)')).toBeDisabled(),
    );
    expect(screen.queryByText('Summarize this PR')).not.toBeInTheDocument();
    expect(screen.queryByText('regenerate')).not.toBeInTheDocument();

    // Resolve the preload's stream.
    const [, handlers] = vi.mocked(streamAi).mock.calls[0];
    const doneState: ReviewState = {
      ...initialState(),
      notes: [
        {
          id: 'n1',
          chunk_id: '__overview__',
          kind: 'initial',
          body: 'Summary body',
          created_at: 't',
          updated_at: 't',
        },
      ],
    };
    handlers.onDone(doneState);

    await waitFor(() => expect(screen.getByText('Summary body')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Ask about this PR… (a)')).not.toBeDisabled();
  });

  it('does not fire a second streamAi call for the same target while its preload is in flight', async () => {
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(streamAi).mockClear();

    render(<App />);

    await waitFor(() => expect(vi.mocked(streamAi)).toHaveBeenCalledTimes(1));

    // The Ask input/button are disabled while busy, so a normal submit
    // can't reach onAsk — but assert the call count stays at 1 regardless
    // of any additional render passes triggered by other effects.
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(streamAi)).toHaveBeenCalledTimes(1);
  });

  it('asking about a chunk cancels an unrelated in-flight preload and proceeds with a new request', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchReview).mockResolvedValue(review);
    vi.mocked(fetchState).mockImplementation(async () => initialState());
    vi.mocked(streamAi).mockClear();

    render(<App />);

    // Overview preload starts automatically (index defaults to -1).
    await waitFor(() => expect(vi.mocked(streamAi)).toHaveBeenCalledTimes(1));

    // Navigate into chunk c1 and ask a question there (different target
    // than the in-flight overview preload).
    await user.click(screen.getByRole('button', { name: /begin review/i }));
    await waitFor(() => expect(screen.getByText('a.ts')).toBeInTheDocument());

    const askInput = screen.getByPlaceholderText('Ask about this chunk… (a)');
    await user.type(askInput, 'what does this do?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    // A new streamAi call for c1 should have been made — the different
    // -target case is unaffected by the same-target no-op guard.
    await waitFor(() =>
      expect(vi.mocked(streamAi)).toHaveBeenCalledWith(
        expect.objectContaining({ chunkId: 'c1', question: 'what does this do?' }),
        expect.anything(),
      ),
    );
  });
});
