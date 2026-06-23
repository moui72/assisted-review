import type { Chunk, PrMeta, PrRef } from '../api.ts';
import { Logo } from './Logo.tsx';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function TopNav({
  pr,
  meta,
  chunks,
  index,
  viewed,
  flagged,
  commented,
  commentCount,
  submitted,
  onJump,
  onOpenHelp,
  onOpenReviews,
  onSubmit,
}: {
  pr: PrRef;
  meta: PrMeta;
  chunks: Chunk[];
  index: number;
  viewed: string[];
  flagged: string[];
  commented: string[];
  commentCount: number;
  submitted: boolean;
  onJump: (i: number) => void;
  onOpenHelp: () => void;
  onOpenReviews: () => void;
  onOpenSettings: () => void;
  onSubmit: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-edge bg-surface">
      <div className="shell flex items-center justify-between gap-6 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-8 w-auto shrink-0 text-fg" variant="icon" />
          <span className="h-8 w-px shrink-0 bg-edge" aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium text-fg">
              {meta.title}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-faint">
              {pr.owner}/{pr.repo}#{pr.number}
              <span className="text-edge-strong"> · </span>
              {meta.base_ref} ← {meta.head_ref}
              {meta.is_draft && <span className="ml-2 text-accent">draft</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="font-mono text-[13px] tabular-nums">
            {index < 0 ? (
              <span className="text-accent">Overview</span>
            ) : (
              <>
                <span className="text-accent">{pad(index + 1)}</span>
                <span className="text-faint"> / {pad(chunks.length)}</span>
              </>
            )}
          </div>
          {submitted ? (
            <span
              title="Review submitted to GitHub"
              className="rounded-md border border-emerald-400/40 bg-emerald-400/[0.08] px-2.5 py-1 font-sans text-[11.5px] font-semibold text-emerald-300"
            >
              ✓ Submitted
            </span>
          ) : (
            <button
              onClick={onSubmit}
              title="Submit review to GitHub"
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-[12px] font-semibold text-bg transition hover:brightness-110"
            >
              Submit
              {commentCount > 0 && (
                <span className="rounded-full bg-bg/25 px-1.5 font-mono text-[11px] tabular-nums">
                  {commentCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onOpenReviews}
            aria-label="Reviews"
            title="View / switch reviews"
            className="rounded border border-edge-strong px-2 py-0.5 font-sans text-[11.5px] text-muted transition hover:border-fg/40 hover:text-fg"
          >
            Reviews
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="rounded border border-edge-strong p-1 text-muted transition hover:border-fg/40 hover:text-fg"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button
            onClick={onOpenHelp}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="rounded border border-edge-strong px-1.5 font-mono text-[12px] text-muted transition hover:border-fg/40 hover:text-fg"
          >
            ?
          </button>
        </div>
      </div>

      {/* Clickable tick strip — overview without a permanent sidebar. */}
      <div className="shell flex h-[18px] items-end gap-[3px] pb-2">
        <button
          onClick={() => onJump(-1)}
          title="Overview"
          aria-label="Overview"
          className={`mr-1 h-[11px] w-[11px] shrink-0 rounded-sm transition-all ${
            index < 0 ? 'bg-accent' : 'bg-edge-strong hover:bg-fg/40'
          }`}
        />
        {chunks.map((c, i) => {
          const isCur = i === index;
          // Previews the (eventual colorblind-safe) tick grammar:
          // flagged=orange, commented=purple, viewed=green, unviewed=grey.
          const state = flagged.includes(c.id)
            ? 'flagged'
            : commented.includes(c.id)
              ? 'commented'
              : viewed.includes(c.id)
                ? 'viewed'
                : 'unviewed';
          const tone = isCur
            ? 'bg-accent'
            : state === 'flagged'
              ? 'bg-orange-400/75'
              : state === 'commented'
                ? 'bg-violet-400/75'
                : state === 'viewed'
                  ? 'bg-emerald-400/40'
                  : 'bg-edge-strong hover:bg-fg/40';
          return (
            <button
              key={c.id}
              onClick={() => onJump(i)}
              title={`${c.id} · ${c.file}${isCur ? '' : ` · ${state}`}`}
              aria-label={`Go to chunk ${i + 1}: ${c.file} (${state})`}
              className={`flex-1 rounded-full transition-all ${tone} ${isCur ? 'h-[11px]' : 'h-[5px]'}`}
            />
          );
        })}
      </div>
    </header>
  );
}
