import { ErrorBanner } from './ErrorBanner.tsx';

export function DeleteReviewConfirm({
  label,
  switchTargetLabel,
  opening,
  error,
  onCancel,
  onConfirm,
}: {
  label: string;
  switchTargetLabel: string | null;
  opening: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="border-t border-edge px-5 py-4">
      <p className="text-[13px] font-medium text-fg">
        Delete <span className="text-red-300">"{label}"</span>?
      </p>
      <p className="mt-0.5 text-[12px] text-muted">
        {switchTargetLabel
          ? `You'll be switched to "${switchTargetLabel}".`
          : 'No other reviews. Your current session will end.'}
      </p>
      {error && (
        <ErrorBanner className="mt-2 py-1.5 text-[12px]">{error}</ErrorBanner>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={opening}
          className="rounded border border-edge-strong px-3 py-1 text-[12px] text-muted transition hover:text-fg disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={opening}
          className="rounded border border-red-400/40 bg-red-400/10 px-3 py-1 text-[12px] text-red-300 transition hover:bg-red-400/20 disabled:opacity-40"
        >
          {opening ? (switchTargetLabel ? 'Switching…' : 'Deleting…') : 'Delete'}
        </button>
      </div>
    </div>
  );
}
