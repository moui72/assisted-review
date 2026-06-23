// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Splash } from '../../web/src/components/Splash.tsx';
import { ThemeProvider } from '../../web/src/theme.tsx';

// Mock the api module so no real fetch calls are made.
vi.mock('../../web/src/api.ts', () => ({
  openReview: vi.fn(),
}));

import { openReview } from '../../web/src/api.ts';

const minimalReview = {
  pr: { owner: 'alice', repo: 'proj', number: 1 },
  meta: {
    title: 'T', author: 'alice', base_ref: 'main', head_ref: 'feat',
    is_draft: false, url: '', head_sha: 'abc', body: '',
  },
  chunks: [],
  overview: { jira: { available: false, keys: [], issues: [] } },
  generated_at: new Date().toISOString(),
};

const minimalState = {
  version: 1,
  pr: { owner: 'alice', repo: 'proj', number: 1 },
  head_sha: 'abc',
  started_at: new Date().toISOString(),
  comments: [],
  flagged: [],
  viewed: [],
  notes: [],
};

function renderSplash(onOpened = vi.fn()) {
  return render(
    <ThemeProvider>
      <Splash onOpened={onOpened} />
    </ThemeProvider>,
  );
}

afterEach(() => vi.resetAllMocks());

describe('Splash', () => {
  it('renders the input and Open button', () => {
    renderSplash();
    expect(screen.getByPlaceholderText(/owner\/repo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('Open button is disabled when input is empty', () => {
    renderSplash();
    expect(screen.getByRole('button', { name: /open/i })).toBeDisabled();
  });

  it('Open button becomes enabled when ref is typed', async () => {
    const user = userEvent.setup();
    renderSplash();
    await user.type(screen.getByPlaceholderText(/owner\/repo/i), 'alice/proj#1');
    expect(screen.getByRole('button', { name: /open/i })).toBeEnabled();
  });

  it('calls openReview and fires onOpened on success', async () => {
    const user = userEvent.setup();
    const onOpened = vi.fn();
    vi.mocked(openReview).mockResolvedValueOnce({ review: minimalReview, state: minimalState });
    renderSplash(onOpened);

    await user.type(screen.getByPlaceholderText(/owner\/repo/i), 'alice/proj#1');
    await user.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(minimalReview, minimalState));
  });

  it('shows an error message when openReview returns an error', async () => {
    const user = userEvent.setup();
    vi.mocked(openReview).mockResolvedValueOnce({ error: 'PR not found' });
    renderSplash();

    await user.type(screen.getByPlaceholderText(/owner\/repo/i), 'alice/proj#999');
    await user.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() => expect(screen.getByText('PR not found')).toBeInTheDocument());
  });

  it('shows a fallback error when openReview returns no error string', async () => {
    const user = userEvent.setup();
    vi.mocked(openReview).mockResolvedValueOnce({});
    renderSplash();

    await user.type(screen.getByPlaceholderText(/owner\/repo/i), 'alice/proj#999');
    await user.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() => expect(screen.getByText(/failed to open review/i)).toBeInTheDocument());
  });

  it('shows an error when openReview throws', async () => {
    const user = userEvent.setup();
    vi.mocked(openReview).mockRejectedValueOnce(new Error('network error'));
    renderSplash();

    await user.type(screen.getByPlaceholderText(/owner\/repo/i), 'alice/proj#1');
    await user.click(screen.getByRole('button', { name: /open/i }));

    await waitFor(() => expect(screen.getByText('network error')).toBeInTheDocument());
  });

  it('submits on Enter key in the input', async () => {
    const user = userEvent.setup();
    const onOpened = vi.fn();
    vi.mocked(openReview).mockResolvedValueOnce({ review: minimalReview, state: minimalState });
    renderSplash(onOpened);

    await user.type(screen.getByPlaceholderText(/owner\/repo/i), 'alice/proj#1{Enter}');

    await waitFor(() => expect(onOpened).toHaveBeenCalled());
  });
});
