// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '../../web/src/components/SettingsPanel.tsx';
import { ThemeProvider } from '../../web/src/theme.tsx';
import type { PreloadConfig } from '../../web/src/api.ts';

const cfg: PreloadConfig = { preload_chunks: 1, preload_overview: true };

function renderPanel(props: Partial<Parameters<typeof SettingsPanel>[0]> = {}) {
  const onClose = vi.fn();
  const onPreloadChange = vi.fn();
  const onOpenInvestigation = vi.fn();
  const result = render(
    <ThemeProvider>
      <SettingsPanel
        open={true}
        onClose={onClose}
        preloadConfig={cfg}
        onPreloadChange={onPreloadChange}
        onOpenInvestigation={onOpenInvestigation}
        {...props}
      />
    </ThemeProvider>,
  );
  return { ...result, onClose, onPreloadChange, onOpenInvestigation };
}

describe('SettingsPanel', () => {
  it('renders when open', () => {
    renderPanel();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const { onClose } = renderPanel();
    // The backdrop is the outermost div; clicking it (not the card) triggers close.
    await userEvent.click(document.querySelector('.fixed')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when esc button is clicked', async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /esc/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe('preloading controls', () => {
    it('highlights the current chunks-ahead value', () => {
      renderPanel({ preloadConfig: { preload_chunks: 2, preload_overview: true } });
      // The "2" chip should have the accent style (aria or text).
      const chip = screen.getByRole('button', { name: '2' });
      expect(chip).toHaveClass('border-accent');
    });

    it('calls onPreloadChange with new chunk count when a chip is clicked', async () => {
      const { onPreloadChange } = renderPanel();
      await userEvent.click(screen.getByRole('button', { name: '3' }));
      expect(onPreloadChange).toHaveBeenCalledWith({ preload_chunks: 3, preload_overview: true });
    });

    it('does not call onPreloadChange when the already-selected chunk chip is clicked', async () => {
      const { onPreloadChange } = renderPanel({ preloadConfig: { preload_chunks: 1, preload_overview: true } });
      await userEvent.click(screen.getByRole('button', { name: '1' }));
      expect(onPreloadChange).not.toHaveBeenCalled();
    });

    it('calls onPreloadChange with preload_overview: false when off is clicked', async () => {
      const { onPreloadChange } = renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'off' }));
      expect(onPreloadChange).toHaveBeenCalledWith({ preload_chunks: 1, preload_overview: false });
    });

    it('calls onPreloadChange with preload_overview: true when on is clicked', async () => {
      const { onPreloadChange } = renderPanel({ preloadConfig: { preload_chunks: 1, preload_overview: false } });
      await userEvent.click(screen.getByRole('button', { name: 'on' }));
      expect(onPreloadChange).toHaveBeenCalledWith({ preload_chunks: 1, preload_overview: true });
    });

    it('renders null preloadConfig without crashing (uses defaults)', () => {
      renderPanel({ preloadConfig: null });
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('appearance controls', () => {
    it('renders Dark and Light theme chips', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
    });

    it('clicking the non-active theme chip toggles the theme', async () => {
      renderPanel();
      // Default theme in test environment is dark; clicking light should toggle.
      await userEvent.click(screen.getByRole('button', { name: 'light' }));
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  describe('version display', () => {
    it('renders the app_version from preloadConfig', () => {
      renderPanel({ preloadConfig: { ...cfg, app_version: '1.11.0' } });
      expect(screen.getByText('1.11.0')).toBeInTheDocument();
      expect(screen.getByText('Version')).toBeInTheDocument();
    });

    it('does not render an About section when app_version is absent', () => {
      renderPanel();
      expect(screen.queryByText('Version')).not.toBeInTheDocument();
    });
  });

  describe('investigation access', () => {
    it('shows "Diff only" when no mode is set', () => {
      renderPanel();
      expect(screen.getByRole('button', { name: 'Diff only' })).toBeInTheDocument();
    });

    it('shows the current mode label', () => {
      renderPanel({ investigationMode: 'always-clone' });
      expect(screen.getByRole('button', { name: 'Persistent clone' })).toBeInTheDocument();
    });

    it('calls onOpenInvestigation when clicked', async () => {
      const { onOpenInvestigation } = renderPanel();
      await userEvent.click(screen.getByRole('button', { name: 'Diff only' }));
      expect(onOpenInvestigation).toHaveBeenCalled();
    });
  });
});
