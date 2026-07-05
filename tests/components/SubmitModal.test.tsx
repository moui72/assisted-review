// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SubmitModal } from '../../web/src/components/SubmitModal.tsx';
import type { Chunk, ReviewState } from '../../web/src/api.ts';

vi.mock('../../web/src/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../web/src/api.ts')>();
  return { ...actual, submitReview: vi.fn() };
});

import { submitReview } from '../../web/src/api.ts';

const chunk: Chunk = {
  id: 'c1',
  file: 'src/foo.ts',
  hunk_header: '@@ -1,1 +1,1 @@',
  old_range: [1, 1],
  new_range: [1, 1],
  context: '',
  diff: '',
  members: [],
};

const state: ReviewState = {
  version: 1,
  pr: { owner: 'alice', repo: 'proj', number: 1 },
  head_sha: 'abc',
  started_at: new Date().toISOString(),
  comments: [],
  flagged: [],
  viewed: [],
  notes: [],
};

const stateWithComment: ReviewState = {
  ...state,
  comments: [
    {
      id: 'd1', chunk_id: 'c1', side: 'RIGHT', line: 5,
      body: 'looks good', created_at: '', updated_at: '',
    },
  ],
};

function renderModal(props: Partial<Parameters<typeof SubmitModal>[0]> = {}) {
  return render(
    <SubmitModal
      open={true}
      onClose={vi.fn()}
      chunks={[chunk]}
      state={state}
      onSubmitted={vi.fn()}
      {...props}
    />,
  );
}

afterEach(() => vi.resetAllMocks());

describe('SubmitModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = renderModal({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows all three verdict options', () => {
    renderModal();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Comment')).toBeInTheDocument();
    expect(screen.getByText('Request changes')).toBeInTheDocument();
  });

  it('defaults to the Comment verdict', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /submit as comment/i })).toBeInTheDocument();
  });

  it('updates submit button label when a different verdict is selected', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText('Approve'));
    expect(screen.getByRole('button', { name: /submit as approve/i })).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows "no drafted comments" when state has no comments', () => {
    renderModal({ state });
    expect(screen.getByText(/no drafted comments/i)).toBeInTheDocument();
  });

  it('lists file-grouped comments when present', () => {
    renderModal({ state: stateWithComment });
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
  });

  it('shows the done screen and calls onSubmitted on success', async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: true,
      html_url: 'https://github.com/review/1',
      state,
    });
    renderModal({ onSubmitted });

    await user.click(screen.getByRole('button', { name: /submit as comment/i }));

    await waitFor(() => expect(screen.getByText(/review submitted/i)).toBeInTheDocument());
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /view on github/i })).toHaveAttribute(
      'href',
      'https://github.com/review/1',
    );
  });

  it('shows a stale warning when submission returns stale', async () => {
    const user = userEvent.setup();
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: false,
      stale: { old: 'abc1234', new_head: 'def5678', inline_count: 1 },
      state,
    });
    renderModal();

    await user.click(screen.getByRole('button', { name: /submit as comment/i }));

    await waitFor(() => expect(screen.getByText(/the pr moved/i)).toBeInTheDocument());
    expect(screen.getByText(/abc1234/)).toBeInTheDocument();
  });

  it('shows an error message when submission returns an error', async () => {
    const user = userEvent.setup();
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: false,
      error: 'gh authentication failed',
      state,
    });
    renderModal();

    await user.click(screen.getByRole('button', { name: /submit as comment/i }));

    await waitFor(() => expect(screen.getByText('gh authentication failed')).toBeInTheDocument());
  });

  it('shows a fallback error message when submitReview throws', async () => {
    const user = userEvent.setup();
    vi.mocked(submitReview).mockRejectedValueOnce(new Error('network failure'));
    renderModal();

    await user.click(screen.getByRole('button', { name: /submit as comment/i }));

    await waitFor(() => expect(screen.getByText('network failure')).toBeInTheDocument());
  });

  it('shows a partial-failure retry banner on a GitLab comment_errors failure, and retrying calls submitReview again', async () => {
    const user = userEvent.setup();
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: false,
      comment_errors: [{ path: 'src/foo.ts', line: 5, error: 'invalid position' }],
      state,
    });
    renderModal();

    await user.click(screen.getByRole('button', { name: /submit as comment/i }));

    await waitFor(() =>
      expect(screen.getByText(/1 inline comment failed to post/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/invalid position/)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry submission/i });
    expect(retryButton).toBeInTheDocument();

    vi.mocked(submitReview).mockResolvedValueOnce({ ok: true, html_url: 'https://gitlab.com/x/y', state });
    await user.click(retryButton);

    expect(vi.mocked(submitReview)).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByText(/review submitted/i)).toBeInTheDocument());
  });
});
