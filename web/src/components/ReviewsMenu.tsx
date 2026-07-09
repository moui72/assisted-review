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
import { DeleteReviewConfirm } from './DeleteReviewConfirm.tsx';
import { GitLabAuthModal } from './GitLabAuthModal.tsx';
import { OpenReviewForm } from './OpenReviewForm.tsx';
import { prLabel, ReviewsList } from './ReviewsList.tsx';

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
  const [gitlabAuthOpen, setGitlabAuthOpen] = useState(false);
  const [pendingRef, setPendingRef] = useState('');
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
      } else if (result.auth_required === 'gitlab') {
        setPendingRef(refToOpen.trim());
        setGitlabAuthOpen(true);
        return;
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
          <OpenReviewForm
            inputRef={inputRef}
            value={ref}
            onChange={setRef}
            onOpen={(r) => void handleOpen(r)}
            onEscape={onClose}
            opening={opening}
            error={openError}
          />
          <ReviewsList
            reviews={reviews}
            loadError={loadError}
            currentKey={currentKey}
            opening={opening}
            confirming={confirming}
            onSwitch={(key) => void handleOpen(key)}
            onDismiss={(pr) => void handleDismiss(pr)}
            onRequestDeleteCurrent={() => setConfirming(true)}
          />
        </div>

        {confirming && (
          <DeleteReviewConfirm
            label={confirmLabel}
            switchTargetLabel={switchTarget ? prLabel(switchTarget) : null}
            opening={opening}
            error={openError}
            onCancel={() => setConfirming(false)}
            onConfirm={() => void handleConfirmDismiss()}
          />
        )}
      </div>
      <GitLabAuthModal
        open={gitlabAuthOpen}
        onClose={() => setGitlabAuthOpen(false)}
        onSuccess={() => {
          setGitlabAuthOpen(false);
          void handleOpen(pendingRef);
        }}
      />
    </div>
  );
}
