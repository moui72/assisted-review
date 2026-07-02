import { prKey, type PrRef, type ReviewSummary } from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';

export function prLabel(s: ReviewSummary) {
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

export function ReviewsList({
  reviews,
  loadError,
  currentKey,
  opening,
  confirming,
  onSwitch,
  onDismiss,
  onRequestDeleteCurrent,
}: {
  reviews: ReviewSummary[] | null;
  loadError: string | null;
  currentKey: string;
  opening: boolean;
  confirming: boolean;
  onSwitch: (key: string) => void;
  onDismiss: (pr: PrRef) => void;
  onRequestDeleteCurrent: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
        Ongoing reviews
      </div>
      {loadError ? (
        <ErrorBanner className="text-[12px] py-1.5">{loadError}</ErrorBanner>
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
                      onClick={() => onSwitch(key)}
                      disabled={opening}
                      className="rounded border border-edge-strong px-2 py-0.5 text-[11.5px] text-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-40"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    onClick={() =>
                      isCurrent ? onRequestDeleteCurrent() : onDismiss(r.pr)
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
  );
}
