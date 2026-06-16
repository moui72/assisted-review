import { useState } from 'react';
import { openReview, type Review, type ReviewState } from '../api.ts';
import { Logo } from './Logo.tsx';
import { ErrorBanner } from './ErrorBanner.tsx';

export function Splash({
  onOpened,
}: {
  onOpened: (review: Review, state: ReviewState) => void;
}) {
  const [ref, setRef] = useState('');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (!ref.trim() || opening) return;
    setOpening(true);
    setError(null);
    try {
      const result = await openReview(ref.trim());
      if (result.review && result.state) {
        onOpened(result.review, result.state);
      } else {
        setError(result.error ?? 'Failed to open review');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-bg px-4">
      <Logo className="h-16 w-auto text-fg/80" />
      <div className="w-full max-w-sm">
        <p className="mb-4 text-center font-sans text-[13px] text-muted">
          Open a pull request to begin reviewing
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleOpen();
            }}
            placeholder="owner/repo#123 or PR URL"
            disabled={opening}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-3 py-2 font-mono text-[12.5px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void handleOpen()}
            disabled={opening || !ref.trim()}
            className="rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-bg transition hover:brightness-110 disabled:opacity-50"
          >
            {opening ? 'Opening…' : 'Open'}
          </button>
        </div>
        {error && (
          <ErrorBanner className="mt-3 text-[12px]">{error}</ErrorBanner>
        )}
      </div>
    </div>
  );
}
