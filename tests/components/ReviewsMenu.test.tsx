// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ReviewsMenu } from '../../web/src/components/ReviewsMenu.tsx';
import type { PrRef } from '../../web/src/api.ts';

vi.mock('../../web/src/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../web/src/api.ts')>();
  return {
    ...actual,
    fetchReviews: vi.fn(),
    openReview: vi.fn(),
    deleteReview: vi.fn(),
    clearActiveReview: vi.fn(),
    authenticateGitLab: vi.fn(),
  };
});

import { fetchReviews, openReview, authenticateGitLab } from '../../web/src/api.ts';

const currentPr: PrRef = { owner: 'alice', repo: 'proj', number: 1, platform: 'github' };

function renderMenu(props: Partial<Parameters<typeof ReviewsMenu>[0]> = {}) {
  const onClose = vi.fn();
  const onSwitched = vi.fn();
  const onCleared = vi.fn();
  const result = render(
    <ReviewsMenu
      open={true}
      currentPr={currentPr}
      onClose={onClose}
      onSwitched={onSwitched}
      onCleared={onCleared}
      {...props}
    />,
  );
  return { ...result, onClose, onSwitched, onCleared };
}

describe('ReviewsMenu — GitLab auth prompt', () => {
  beforeEach(() => {
    vi.mocked(fetchReviews).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.mocked(openReview).mockReset();
    vi.mocked(authenticateGitLab).mockReset();
  });

  it('opens GitLabAuthModal instead of a generic error when auth_required is gitlab', async () => {
    vi.mocked(openReview).mockResolvedValueOnce({ auth_required: 'gitlab' });
    const { onSwitched } = renderMenu();

    const input = screen.getByPlaceholderText('owner/repo#123 or PR URL');
    await userEvent.type(input, 'group/proj!5');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() =>
      expect(screen.getByText('Connect to GitLab')).toBeInTheDocument(),
    );
    expect(onSwitched).not.toHaveBeenCalled();
  });

  it('retries the same ref after a successful token save, and closes the menu', async () => {
    vi.mocked(openReview)
      .mockResolvedValueOnce({ auth_required: 'gitlab' })
      .mockResolvedValueOnce({
        review: { pr: currentPr } as never,
        state: {} as never,
      });
    vi.mocked(authenticateGitLab).mockResolvedValueOnce(undefined);
    const { onSwitched, onClose } = renderMenu();

    const input = screen.getByPlaceholderText('owner/repo#123 or PR URL');
    await userEvent.type(input, 'group/proj!5');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(screen.getByText('Connect to GitLab')).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByPlaceholderText('glpat-xxxxxxxxxxxxxxxxxxxx'),
      'glpat-test-token',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save token' }));

    await waitFor(() => expect(onSwitched).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(openReview)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(openReview)).toHaveBeenNthCalledWith(2, 'group/proj!5');
    expect(screen.queryByText('Connect to GitLab')).not.toBeInTheDocument();
  });

  it('shows the generic error banner for a non-auth failure', async () => {
    vi.mocked(openReview).mockResolvedValueOnce({ error: 'not found' });
    renderMenu();

    const input = screen.getByPlaceholderText('owner/repo#123 or PR URL');
    await userEvent.type(input, 'owner/repo#999');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(screen.getByText('not found')).toBeInTheDocument());
    expect(screen.queryByText('Connect to GitLab')).not.toBeInTheDocument();
  });
});
