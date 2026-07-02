import { useState } from 'react';
import { authenticateGitLab } from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';

export function GitLabAuthModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await authenticateGitLab(token.trim());
      setToken('');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save token');
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && token.trim() && !saving) void handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="flex w-[440px] flex-col rounded-xl border border-edge bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="text-[13px] font-semibold text-fg">Connect to GitLab</h2>
          <button
            onClick={onClose}
            className="text-[18px] leading-none text-muted hover:text-fg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-[12px] text-muted">
            Enter a Personal Access Token with <code className="font-mono">api</code> scope.
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={handleKey}
            placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
            autoFocus
            className="w-full rounded border border-edge bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <p className="text-[11px] text-faint">
            Create one at your GitLab instance under{' '}
            <span className="font-mono">/-/user_settings/personal_access_tokens</span>.
          </p>
          {error && <ErrorBanner className="text-[11px]">{error}</ErrorBanner>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-edge px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-edge-strong px-3 py-1.5 text-[12.5px] text-muted hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!token.trim() || saving}
            className="rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-bg hover:brightness-110 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save token'}
          </button>
        </div>
      </div>
    </div>
  );
}
