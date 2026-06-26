import { useMemo, useState } from 'react';
import {
  submitReview,
  VERDICTS,
  GITLAB_VERDICTS,
  type Chunk,
  type DraftComment,
  type GitLabVerdict,
  type ReviewState,
  type Verdict,
} from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';

type AnyVerdict = Verdict | GitLabVerdict;

const VERDICT_META: Record<Verdict, { label: string; hint: string; tone: string }> = {
  COMMENT: { label: 'Comment', hint: 'Leave feedback without an explicit verdict', tone: 'text-fg' },
  APPROVE: { label: 'Approve', hint: 'Sign off on the changes', tone: 'text-emerald-300' },
  REQUEST_CHANGES: {
    label: 'Request changes',
    hint: 'Block until the feedback is addressed',
    tone: 'text-orange-300',
  },
};

function metaFor(v: AnyVerdict): { label: string; hint: string; tone: string } {
  const key = v === 'comment' ? 'COMMENT' : v === 'approve' ? 'APPROVE' : v;
  return VERDICT_META[key];
}

type Phase = 'edit' | 'sending' | 'done';

/** Group drafts by file for the pre-submit summary. */
function useGrouped(chunks: Chunk[], comments: DraftComment[]) {
  return useMemo(() => {
    const fileById = new Map(chunks.map((c) => [c.id, c.file]));
    const byFile = new Map<string, number>();
    for (const c of comments) {
      const file = fileById.get(c.chunk_id) ?? '(unknown)';
      byFile.set(file, (byFile.get(file) ?? 0) + 1);
    }
    return [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [chunks, comments]);
}

export function SubmitModal({
  open,
  onClose,
  chunks,
  state,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  chunks: Chunk[];
  state: ReviewState;
  onSubmitted: (state: ReviewState) => void;
}) {
  const platform = state.pr.platform;
  const verdicts: readonly AnyVerdict[] = platform === 'gitlab' ? GITLAB_VERDICTS : VERDICTS;
  const defaultVerdict: AnyVerdict = platform === 'gitlab' ? 'comment' : 'COMMENT';

  const [verdict, setVerdict] = useState<AnyVerdict>(defaultVerdict);
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<Phase>('edit');
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<{ old: string; new_head: string; inline_count: number } | null>(
    null,
  );
  const [url, setUrl] = useState<string | undefined>();
  const [commentErrors, setCommentErrors] = useState<
    Array<{ path: string; line: number | null; error: string }>
  >([]);

  const grouped = useGrouped(chunks, state.comments);
  const commentCount = state.comments.length;

  if (!open) return null;

  const submit = async () => {
    setPhase('sending');
    setError(null);
    setStale(null);
    setCommentErrors([]);
    try {
      const res = await submitReview(verdict, body.trim());
      if (res.ok) {
        setUrl(res.html_url);
        setCommentErrors(res.comment_errors ?? []);
        setPhase('done');
        onSubmitted(res.state);
      } else if (res.stale) {
        setStale(res.stale);
        setPhase('edit');
      } else {
        setError(res.error ?? 'Submission failed');
        setPhase('edit');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('edit');
    }
  };

  const sending = phase === 'sending';
  const viewLabel = platform === 'gitlab' ? 'View on GitLab →' : 'View on GitHub →';
  const isComment = verdict === 'COMMENT' || verdict === 'comment';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
      onClick={sending ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-[520px] flex-col rounded-xl border border-edge bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="text-[13px] font-semibold tracking-wide text-fg">
            {phase === 'done' ? 'Review submitted' : 'Submit review'}
          </h2>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded border border-edge-strong px-1.5 py-0.5 font-mono text-[11px] text-muted transition hover:text-fg disabled:opacity-40"
          >
            esc
          </button>
        </div>

        {phase === 'done' ? (
          <div className="px-5 py-6 text-center">
            <div className="mb-2 text-[28px]" aria-hidden>
              ✓
            </div>
            <p className="font-sans text-[14px] text-fg">
              Posted as <span className="font-semibold">{metaFor(verdict).label}</span>
              {commentCount > 0 && ` with ${commentCount} inline comment${commentCount === 1 ? '' : 's'}`}.
            </p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-bg transition hover:brightness-110"
              >
                {viewLabel}
              </a>
            )}
            {commentErrors.length > 0 && (
              <div className="mt-3 rounded-md border border-orange-400/40 bg-orange-400/[0.08] px-3 py-2 text-left font-sans text-[12.5px] text-orange-200">
                <div className="font-semibold">
                  {commentErrors.length} inline comment{commentErrors.length === 1 ? '' : 's'} failed to post.
                </div>
                <ul className="mt-1 space-y-0.5">
                  {commentErrors.map((e, i) => (
                    <li key={i} className="font-mono text-[11px] text-orange-200/80">
                      {e.path}:{e.line ?? '?'} — {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="thin-scroll min-h-0 flex-1 overflow-auto px-5 py-4">
            {/* Verdict */}
            <div className="space-y-1.5">
              {verdicts.map((v) => {
                const m = metaFor(v);
                const on = verdict === v;
                return (
                  <button
                    key={v}
                    onClick={() => setVerdict(v)}
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                      on ? 'border-accent bg-accent/[0.07]' : 'border-edge hover:border-edge-strong'
                    }`}
                  >
                    <span
                      className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
                        on ? 'border-accent' : 'border-edge-strong'
                      }`}
                    >
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-medium ${m.tone}`}>{m.label}</span>
                      <span className="block font-sans text-[11.5px] text-faint">{m.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Summary body */}
            <div className="mt-4">
              <label className="mb-1 block font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
                Summary {isComment && <span className="normal-case">(recommended)</span>}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Overall review comment…"
                className="w-full resize-y rounded-md border border-edge bg-bg px-3 py-2 font-sans text-[13px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
            </div>

            {/* Pending comments summary */}
            <div className="mt-4">
              <div className="mb-1.5 font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
                Inline comments · {commentCount}
              </div>
              {commentCount === 0 ? (
                <p className="font-sans text-[12.5px] text-faint italic">
                  No drafted comments — only the summary will be posted.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {grouped.map(([file, n]) => (
                    <li
                      key={file}
                      className="flex items-center justify-between gap-3 font-mono text-[12px]"
                    >
                      <span className="truncate text-fg/80">{file}</span>
                      <span className="shrink-0 text-faint">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {stale && (
              <div className="mt-4 rounded-md border border-orange-400/40 bg-orange-400/[0.08] px-3 py-2 font-sans text-[12.5px] text-orange-200">
                <div className="font-semibold">The {platform === 'gitlab' ? 'MR' : 'PR'} moved since you started.</div>
                <p className="mt-0.5 text-orange-200/80">
                  Your {stale.inline_count} inline comment{stale.inline_count === 1 ? '' : 's'} anchor to{' '}
                  <code className="font-mono">{stale.old.slice(0, 7)}</code>, but HEAD is now{' '}
                  <code className="font-mono">{stale.new_head.slice(0, 7)}</code>. Re-fetch the{' '}
                  {platform === 'gitlab' ? 'MR' : 'PR'} to re-anchor before submitting inline comments.
                </p>
              </div>
            )}

            {error && (
              <ErrorBanner className="mt-4 text-[12.5px] py-2">{error}</ErrorBanner>
            )}
          </div>
        )}

        {phase !== 'done' && (
          <div className="flex items-center justify-between border-t border-edge px-5 py-3">
            <span className="font-sans text-[12px] text-faint">
              {commentCount} comment{commentCount === 1 ? '' : 's'} · {chunks.length} chunks
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-md border border-edge-strong px-3 py-1.5 text-[12.5px] text-muted transition hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={sending}
                className="rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-bg transition hover:brightness-110 disabled:opacity-50"
              >
                {sending ? 'Submitting…' : `Submit as ${metaFor(verdict).label}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
