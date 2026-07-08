// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { InvestigationModal } from '../../web/src/components/InvestigationModal.tsx';
import type { InvestigationConfig } from '../../web/src/api.ts';

vi.mock('../../web/src/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../web/src/api.ts')>();
  return { ...actual, saveInvestigationConfig: vi.fn() };
});

import { saveInvestigationConfig } from '../../web/src/api.ts';

function renderModal(props: Partial<Parameters<typeof InvestigationModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const result = render(
    <InvestigationModal open={true} onClose={onClose} onSuccess={onSuccess} {...props} />,
  );
  return { ...result, onClose, onSuccess };
}

const config: InvestigationConfig = {
  platform: 'github',
  owner: 'o',
  repo: 'r',
  mode: 'local-path',
  local_path: '/repo',
  chosen_at: new Date().toISOString(),
};

describe('InvestigationModal', () => {
  afterEach(() => vi.mocked(saveInvestigationConfig).mockReset());

  it('renders all five choices', () => {
    renderModal();
    expect(screen.getByText('Diff only (default)')).toBeInTheDocument();
    expect(screen.getByText('Local checkout')).toBeInTheDocument();
    expect(screen.getByText('Full content of changed files')).toBeInTheDocument();
    expect(screen.getByText('Temporary clone')).toBeInTheDocument();
    expect(screen.getByText('Persistent clone')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Investigation access')).not.toBeInTheDocument();
  });

  it('selecting local-path reveals a path input', async () => {
    renderModal();
    expect(screen.queryByPlaceholderText('/path/to/local/checkout')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Local checkout'));
    expect(screen.getByPlaceholderText('/path/to/local/checkout')).toBeInTheDocument();
  });

  it('Save is disabled for local-path until a path is entered', async () => {
    renderModal();
    await userEvent.click(screen.getByText('Local checkout'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('/path/to/local/checkout'), '/repo');
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('Save calls saveInvestigationConfig with mode none by default', async () => {
    vi.mocked(saveInvestigationConfig).mockResolvedValueOnce({
      ...config,
      mode: 'none',
      local_path: undefined,
    });
    const { onSuccess } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(vi.mocked(saveInvestigationConfig)).toHaveBeenCalledWith('none', undefined);
  });

  it('Save calls saveInvestigationConfig with mode and local_path for local-path', async () => {
    vi.mocked(saveInvestigationConfig).mockResolvedValueOnce(config);
    const { onSuccess } = renderModal();
    await userEvent.click(screen.getByText('Local checkout'));
    await userEvent.type(screen.getByPlaceholderText('/path/to/local/checkout'), '/repo');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(config));
    expect(vi.mocked(saveInvestigationConfig)).toHaveBeenCalledWith('local-path', '/repo');
  });

  it('shows "Cloning…" while saving a clone mode', async () => {
    let resolveSave: (c: InvestigationConfig) => void;
    vi.mocked(saveInvestigationConfig).mockReturnValueOnce(
      new Promise((resolve) => { resolveSave = resolve; }),
    );
    renderModal();
    await userEvent.click(screen.getByText('Temporary clone'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Cloning…' })).toBeInTheDocument();
    resolveSave!({ ...config, mode: 'temp-clone' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cloning…' })).not.toBeInTheDocument());
  });

  it('renders an error banner when save fails', async () => {
    vi.mocked(saveInvestigationConfig).mockRejectedValueOnce(new Error('clone failed: not found'));
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('clone failed: not found')).toBeInTheDocument());
  });

  it('Cancel calls onClose without saving', async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(saveInvestigationConfig)).not.toHaveBeenCalled();
  });
});
