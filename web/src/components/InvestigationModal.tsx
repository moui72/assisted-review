import { useState } from 'react';
import { saveInvestigationConfig, errMsg, type InvestigationConfig } from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';

type Mode = InvestigationConfig['mode'];

const CHOICES: Array<{ mode: Mode; label: string; description: string }> = [
  {
    mode: 'none',
    label: 'Diff only (default)',
    description: 'Claude answers only from the diff text shown — no file/repo access at all.',
  },
  {
    mode: 'local-path',
    label: 'Local checkout',
    description: 'Point at a directory you already have checked out. Full read access to that repo.',
  },
  {
    mode: 'api',
    label: 'Full content of changed files',
    description:
      'Fetches complete file content for files touched by the diff via the GitHub/GitLab API — ' +
      'no clone needed. Scope limit: changed files only, not the whole repo.',
  },
  {
    mode: 'temp-clone',
    label: 'Temporary clone',
    description: 'Clones the repo for this review session only; deleted when the review closes.',
  },
  {
    mode: 'always-clone',
    label: 'Persistent clone',
    description: 'Clones the repo and keeps it, refreshing before each use. Pruned after 30 days idle.',
  },
];

export function InvestigationModal({
  open,
  currentMode,
  onClose,
  onSuccess,
}: {
  open: boolean;
  currentMode?: Mode;
  onClose: () => void;
  onSuccess: (config: InvestigationConfig) => void;
}) {
  const [mode, setMode] = useState<Mode>(currentMode ?? 'none');
  const [localPath, setLocalPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const isClone = mode === 'temp-clone' || mode === 'always-clone';

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const config = await saveInvestigationConfig(
        mode,
        mode === 'local-path' ? localPath.trim() : undefined,
      );
      onSuccess(config);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      onKeyDown={handleKey}
    >
      <div
        className="flex w-[520px] flex-col rounded-xl border border-edge bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="text-[13px] font-semibold text-fg">Investigation access</h2>
          <button
            onClick={onClose}
            className="text-[18px] leading-none text-muted hover:text-fg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 px-5 py-4">
          <p className="text-[12px] text-muted">
            Choose how much of the repo Claude can see when investigating this PR/MR.
          </p>
          {CHOICES.map((c) => (
            <label
              key={c.mode}
              className="flex cursor-pointer items-start gap-2 rounded border border-edge px-3 py-2 hover:border-edge-strong"
            >
              <input
                type="radio"
                name="investigation-mode"
                value={c.mode}
                checked={mode === c.mode}
                onChange={() => setMode(c.mode)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12.5px] font-medium text-fg">{c.label}</span>
                <span className="block text-[11px] text-muted">{c.description}</span>
              </span>
            </label>
          ))}
          {mode === 'local-path' && (
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="/path/to/local/checkout"
              autoFocus
              className="w-full rounded border border-edge bg-surface-2 px-3 py-1.5 font-mono text-[12px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
          )}
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
            disabled={saving || (mode === 'local-path' && !localPath.trim())}
            className="rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-bg hover:brightness-110 disabled:opacity-40"
          >
            {saving ? (isClone ? 'Cloning…' : 'Saving…') : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
