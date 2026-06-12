import type { RefObject } from 'react';
import type { Anchor } from '../diff.ts';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 rounded border border-edge-strong bg-bg px-1 py-px font-mono text-[10px] text-faint">
      {children}
    </kbd>
  );
}

export function ResponseBar({
  draft,
  onDraft,
  anchor,
  onClearAnchor,
  flagged,
  viewed,
  textareaRef,
  canPrev,
  canNext,
  onComment,
  onFlag,
  onAskAi,
  onMarkViewed,
  onMarkUnread,
  onNext,
  onPrev,
  isMac,
}: {
  draft: string;
  onDraft: (text: string) => void;
  anchor: Anchor | null;
  onClearAnchor: () => void;
  flagged: boolean;
  viewed: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  canPrev: boolean;
  canNext: boolean;
  onComment: () => void;
  onFlag: () => void;
  onAskAi: () => void;
  onMarkViewed: () => void;
  onMarkUnread: () => void;
  onNext: () => void;
  onPrev: () => void;
  isMac: boolean;
}) {
  const mod = isMac ? '⌘' : 'Ctrl+';
  const hasDraft = draft.trim().length > 0;
  return (
    <footer className="shrink-0 border-t border-edge bg-surface">
      <div className="shell py-3">
        <div className="mb-1.5 flex items-center gap-2 text-[11px]">
          {anchor ? (
            <>
              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-accent">
                line {anchor.line} · {anchor.side}
              </span>
              <button
                onClick={onClearAnchor}
                className="text-faint transition hover:text-fg"
              >
                clear
              </button>
            </>
          ) : (
            <span className="text-faint">commenting on the whole chunk — click a line to anchor</span>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && hasDraft) onComment();
          }}
          placeholder={
            anchor ? `Comment on line ${anchor.line}…  (${mod}↵)` : `Comment on this chunk…  (${mod}↵)`
          }
          rows={2}
          className="thin-scroll w-full resize-none rounded-md border border-edge bg-bg px-3 py-2 font-sans text-[13.5px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none"
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onComment}
              disabled={!hasDraft}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-bg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Comment
              <Kbd>{mod}↵</Kbd>
            </button>
            <button
              onClick={onFlag}
              className={`rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition ${
                flagged
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-edge-strong text-muted hover:border-fg/30 hover:text-fg'
              }`}
            >
              {flagged ? 'Flagged' : 'Flag'}
              <Kbd>f</Kbd>
            </button>
            <button
              onClick={onAskAi}
              title="Streams from Claude — wired in slice 3"
              className="rounded-md border border-edge-strong px-3 py-1.5 text-[12.5px] font-medium text-muted transition hover:border-fg/30 hover:text-fg"
            >
              ✦ Ask Claude
              <Kbd>a</Kbd>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Pure navigation — does not change the chunk's viewed state. */}
            <button
              onClick={onPrev}
              disabled={!canPrev}
              className="rounded-md px-2.5 py-1.5 text-[12.5px] text-muted transition enabled:hover:text-fg disabled:opacity-30"
            >
              Prev
              <Kbd>←</Kbd>
            </button>
            <button
              onClick={onNext}
              disabled={!canNext}
              className="rounded-md px-2.5 py-1.5 text-[12.5px] text-muted transition enabled:hover:text-fg disabled:opacity-30"
            >
              Next
              <Kbd>→</Kbd>
            </button>
            <span className="mx-1 h-5 w-px bg-edge" />
            {/* Marks the chunk viewed/unviewed (dirties state). */}
            {viewed && (
              <button
                onClick={onMarkUnread}
                className="rounded-md px-3 py-1.5 text-[12.5px] font-medium text-emerald-300/80 transition hover:text-emerald-200"
              >
                Mark unread
                <Kbd>esc</Kbd>
              </button>
            )}
            <button
              onClick={onMarkViewed}
              className="rounded-md border border-edge-strong px-3 py-1.5 text-[12.5px] font-medium text-fg transition hover:border-fg/40"
            >
              {viewed ? 'Viewed ✓' : 'Mark viewed'}
              <Kbd>↵</Kbd>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
