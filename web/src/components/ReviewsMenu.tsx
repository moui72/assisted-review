import { useEffect, useRef, useState } from 'react';
import {
  clearActiveReview,
  deleteReview,
  errMsg,
  fetchReviews,
  openReview,
  prKey,
  type PrRef,
  type Review,
  type ReviewState,
  type ReviewSummary,
} from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';

function prLabel(s: ReviewSummary) {
  return s.meta?.title ?? prKey(s.pr);
}

function Progress({ s }: { s: ReviewSummary }) {
  const parts: string[] = [];
  if (s.viewed_count > 0) parts.push(`${s.viewed_count} viewed`);
  if (s.comment_count > 0)
    parts.push(`${s.comment_count} comment${s.comment_count === 1 ? '' : 's'}`);
  if (s.flagged_count > 0) parts.push(`${s.flagged_count} flagged`);
  if (s.submitted) parts.push('submitted');
  return (
    <span className="font-mono text-[11px] text-faint">
      {parts.length ? parts.join(' · ') : 'not started'}
    </span>
  );
}

export function ReviewsMenu({
  open,
  currentPr,
  onClose,
  onSwitched,
  onCleared,
}: {
  open: boolean;
  currentPr: PrRef;
  onClose: () => void;
  onSwitched: (review: Review, state: ReviewState) => void;
  onCleared: () => void;
}) {
  const [reviews, setReviews] = useState<ReviewSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    fetchReviews()
      .then(setReviews)
      .catch((e: unknown) =>
        setLoadError(errMsg(e)),
      );
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const currentKey = prKey(currentPr);
  const currentSummary = reviews?.find((r) => prKey(r.pr) === currentKey) ?? null;
  const confirmLabel = currentSummary ? prLabel(currentSummary) : currentKey;
  const switchTarget = reviews?.find((r) => prKey(r.pr) !== currentKey) ?? null;

  const handleOpen = async (refToOpen: string) => {
    if (!refToOpen.trim() || opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      const result = await openReview(refToOpen.trim());
      if (result.review && result.state) {
        onSwitched(result.review, result.state);
        onClose();
      } else {
        setOpenError(result.error ?? 'Failed to open review');
      }
    } catch (e) {
      setOpenError(errMsg(e));
    } finally {
      setOpening(false);
    }
  };

  const handleDismiss = async (pr: PrRef) => {
    try {
      await deleteReview(pr);
      setReviews(
        (prev) => prev?.filter((r) => prKey(r.pr) !== prKey(pr)) ?? null,
      );
    } catch {
      // Best-effort: delete failures are non-fatal, list is already updated optimistically
    }
  };

  const handleConfirmDismiss = async () => {
    setConfirming(false);
    if (switchTarget) {
      // Switch to next review, then delete the current one.
      setOpening(true);
      setOpenError(null);
      try {
        const result = await openReview(prKey(switchTarget.pr));
        if (result.review && result.state) {
          await deleteReview(currentPr).catch(() => {});
          onSwitched(result.review, result.state);
          onClose();
        } else {
          setOpenError('Failed to switch reviews');
        }
      } catch (e) {
        setOpenError(errMsg(e));
      } finally {
        setOpening(false);
      }
    } else {
      // No other reviews — clear the session entirely.
      await clearActiveReview().catch(() => {});
      onCleared();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
      onClick={opening ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[540px] flex-col rounded-xl border border-edge bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-fg">
            Reviews
          </h2>
          <button
            onClick={onClose}
            disabled={opening}
            className="rounded border border-edge-strong px-1.5 py-0.5 font-mono text-[11px] text-muted transition hover:text-fg disabled:opacity-40"
          >
            esc
          </button>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-auto px-5 py-4">
          {/* Launch new review */}
          <div className="mb-4">
            <label className="mb-1.5 block font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
              Open a review
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleOpen(ref);
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="owner/repo#123 or PR URL"
                disabled={opening}
                className="min-w-0 flex-1 rounded-md border border-edge bg-bg px-3 py-1.5 font-mono text-[12.5px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => void handleOpen(ref)}
                disabled={opening || !ref.trim()}
                className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-bg transition hover:brightness-110 disabled:opacity-50"
              >
                {opening ? 'Opening…' : 'Open'}
              </button>
            </div>
            {openError && (
              <ErrorBanner className="mt-2 text-[12px] py-1.5">
                {openError}
              </ErrorBanner>
            )}
          </div>

          {/* Existing reviews list */}
          <div>
            <div className="mb-1.5 font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
              Ongoing reviews
            </div>
            {loadError ? (
              <ErrorBanner className="text-[12px] py-1.5">
                {loadError}
              </ErrorBanner>
            ) : reviews === null ? (
              <p className="font-mono text-[12px] text-faint">Loading…</p>
            ) : reviews.length === 0 ? (
              <p className="font-sans text-[12.5px] text-faint italic">
                No saved reviews yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {reviews.map((r) => {
                  const key = prKey(r.pr);
                  const isCurrent = key === currentKey;
                  return (
                    <li
                      key={key}
                      className={`flex items-start gap-2 rounded-md border px-3 py-2 ${
                        isCurrent
                          ? 'border-accent/40 bg-accent/[0.06]'
                          : 'border-edge hover:border-edge-strong'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-fg">
                          {prLabel(r)}
                          {isCurrent && (
                            <span className="ml-2 rounded-full bg-accent/20 px-1.5 font-mono text-[10px] text-accent">
                              current
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-faint/70">
                            {key}
                          </span>
                          <span className="text-edge-strong">·</span>
                          <Progress s={r} />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!isCurrent && (
                          <button
                            onClick={() => void handleOpen(key)}
                            disabled={opening}
                            className="rounded border border-edge-strong px-2 py-0.5 text-[11.5px] text-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-40"
                          >
                            Switch
                          </button>
                        )}
                        <button
                          onClick={() =>
                            isCurrent
                              ? setConfirming(true)
                              : void handleDismiss(r.pr)
                          }
                          disabled={opening || (isCurrent && confirming)}
                          title="Remove from list"
                          className="rounded border border-edge-strong px-2 py-0.5 text-[11.5px] text-muted transition hover:border-red-400/40 hover:text-red-300 disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Confirmation footer for deleting the current review */}
        {confirming && (
          <div className="border-t border-edge px-5 py-4">
            <p className="text-[13px] font-medium text-fg">
              Delete{' '}
              <span className="text-red-300">"{confirmLabel}"</span>?
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              {switchTarget
                ? `You'll be switched to "${prLabel(switchTarget)}".`
                : 'No other reviews. Your current session will end.'}
            </p>
            {openError && (
              <ErrorBanner className="mt-2 py-1.5 text-[12px]">
                {openError}
              </ErrorBanner>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={opening}
                className="rounded border border-edge-strong px-3 py-1 text-[12px] text-muted transition hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDismiss()}
                disabled={opening}
                className="rounded border border-red-400/40 bg-red-400/10 px-3 py-1 text-[12px] text-red-300 transition hover:bg-red-400/20 disabled:opacity-40"
              >
                {opening
                  ? switchTarget
                    ? 'Switching…'
                    : 'Deleting…'
                  : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
