import { useState, type RefObject } from 'react';
import type { AiNoteKind, StoredNote } from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';
import { Markdown } from './Markdown.tsx';

/** A note not yet persisted — the live-streaming preview shown while an AI
 *  request is in flight. Same content fields as `StoredNote`, minus
 *  the id/chunk_id/created_at it doesn't have yet. */
type NotePreview = Pick<StoredNote, 'kind' | 'body' | 'prompt' | 'suggested_action'>;

const KIND_LABEL: Partial<Record<AiNoteKind, string>> = {
  context: 'context',
  investigation: 'asked',
  error: 'error',
};

function Note({
  note,
  onDelete,
  live,
}: {
  note: StoredNote | NotePreview;
  onDelete?: (id: string) => void;
  live?: boolean;
}) {
  const label = KIND_LABEL[note.kind];
  const tone = note.kind === 'initial' ? 'text-fg/85' : 'text-muted';
  return (
    <div className="group">
      {(label || (onDelete && 'id' in note)) && (
        <p className="font-serif text-[14.5px] leading-[1.7]">
          {label && (
            <span className="mr-2 align-middle font-sans text-[10px] font-medium tracking-[0.14em] text-accent/80 uppercase">
              {label}
              {note.kind === 'investigation' && note.prompt ? ` · ${note.prompt}` : ''}
            </span>
          )}
          {onDelete && 'id' in note && (
            <button
              onClick={() => onDelete(note.id)}
              className="ml-2 align-middle font-sans text-[10px] text-faint opacity-0 transition group-hover:opacity-100 hover:text-[var(--del-fg)]"
            >
              delete
            </button>
          )}
        </p>
      )}
      <div className="flex items-start">
        <Markdown className={`font-serif text-[14.5px] leading-[1.7] ${tone}`}>{note.body}</Markdown>
        {live && <span className="ml-0.5 inline-block animate-pulse text-accent">▍</span>}
      </div>
      {note.suggested_action && (
        <div className="mt-2 flex gap-2 rounded-md border border-accent/25 bg-accent/[0.07] px-3 py-2">
          <span className="select-none text-accent" aria-hidden>
            →
          </span>
          <p className="font-sans text-[12.5px] leading-relaxed text-fg/80">
            <span className="font-semibold tracking-wide text-accent/90">Suggested action </span>
            {note.suggested_action}
          </p>
        </div>
      )}
    </div>
  );
}

// AI commentary: an editor's margin annotation (serif), plus an ask box that
// streams a live answer. Empty question = "explain this chunk".
export function AiCommentary({
  notes,
  deletableNoteIds,
  streaming,
  busy,
  error,
  askRef,
  onAsk,
  onStop,
  onDeleteNote,
  subject = 'chunk',
}: {
  notes: StoredNote[];
  /** Which of `notes` are actually persisted (and thus safe to delete) —
   *  mock notes carry a fake id but were never written to
   *  `ReviewState.notes`, so deleting one would silently no-op. */
  deletableNoteIds: Set<string>;
  streaming: { kind: AiNoteKind; text: string } | null;
  busy: boolean;
  error: string | null;
  askRef: RefObject<HTMLInputElement | null>;
  onAsk: (question: string) => void;
  onStop?: () => void;
  onDeleteNote: (id: string) => void;
  subject?: 'chunk' | 'PR';
}) {
  const [q, setQ] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    onAsk(q);
    setQ('');
  };

  const empty = notes.length === 0 && !streaming && !busy && !error;

  return (
    <section className="rail-top thin-scroll relative z-10 max-h-[34%] shrink-0 overflow-auto border-t border-edge bg-surface">
      <div className="shell py-4">
        <div className="mb-2.5 flex items-center gap-3">
          <span className="text-accent" aria-hidden>
            ✦
          </span>
          <span className="font-sans text-[10px] font-semibold tracking-[0.22em] text-muted uppercase">
            AI
          </span>
          <span className="h-px flex-1 bg-edge" />
          <form onSubmit={submit} className="flex items-center gap-1.5">
            <input
              ref={askRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={busy}
              placeholder={subject === 'PR' ? 'Ask about this PR…  (a)' : 'Ask about this chunk…  (a)'}
              className="w-64 rounded-md border border-edge bg-bg px-2.5 py-1 font-sans text-[12.5px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-edge-strong px-2.5 py-1 text-[12px] font-medium text-muted transition enabled:hover:border-fg/30 enabled:hover:text-fg disabled:opacity-40"
            >
              {busy ? '…' : q.trim() ? 'Ask' : 'Explain'}
            </button>
            {streaming && onStop && (
              <button
                type="button"
                onClick={onStop}
                className="rounded-md border border-[var(--del-fg)]/45 px-2.5 py-1 text-[12px] font-medium text-[var(--del-fg)]/90 transition hover:bg-[var(--del-bg)]"
              >
                Stop
              </button>
            )}
          </form>
        </div>

        {error && (
          <ErrorBanner className="mb-2">{error}</ErrorBanner>
        )}

        <div className="space-y-2 border-l border-accent/35 pl-4">
          {notes.map((n) => (
            <Note
              key={n.id}
              note={n}
              onDelete={deletableNoteIds.has(n.id) ? onDeleteNote : undefined}
            />
          ))}
          {streaming && (
            <Note
              note={{ kind: streaming.kind, body: streaming.text || '…' }}
              live
            />
          )}
          {empty && (
            <p className="font-serif text-[14px] text-faint italic">
              {subject === 'PR'
                ? 'No summary yet — hit Explain to summarize this PR.'
                : 'No commentary yet — ask a question, or hit Explain.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
