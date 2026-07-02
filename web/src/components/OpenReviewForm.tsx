import type { RefObject } from 'react';
import { ErrorBanner } from './ErrorBanner.tsx';

export function OpenReviewForm({
  inputRef,
  value,
  onChange,
  onOpen,
  onEscape,
  opening,
  error,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onOpen: (ref: string) => void;
  onEscape: () => void;
  opening: boolean;
  error: string | null;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
        Open a review
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpen(value);
            if (e.key === 'Escape') onEscape();
          }}
          placeholder="owner/repo#123 or PR URL"
          disabled={opening}
          className="min-w-0 flex-1 rounded-md border border-edge bg-bg px-3 py-1.5 font-mono text-[12.5px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => onOpen(value)}
          disabled={opening || !value.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-bg transition hover:brightness-110 disabled:opacity-50"
        >
          {opening ? 'Opening…' : 'Open'}
        </button>
      </div>
      {error && (
        <ErrorBanner className="mt-2 text-[12px] py-1.5">{error}</ErrorBanner>
      )}
    </div>
  );
}
