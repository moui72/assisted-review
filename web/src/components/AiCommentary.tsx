import { useState, type RefObject } from 'react';
import type { AiNoteKind } from '../api.ts';
import { ErrorBanner } from './ErrorBanner.tsx';

/** A note to display — `id` present means it's persisted (and deletable). */
export interface DisplayNote {
  id?: string;
  kind: AiNoteKind;
  prompt?: string;
  body: string;
  suggested_action?: string;
}

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
  note: DisplayNote;
  onDelete?: (id: string) => void;
  live?: boolean;
}) {
  const label = KIND_LABEL[note.kind];
  const tone = note.kind === 'initial' ? 'text-fg/85' : 'text-muted';
  return (
    <div className="group">
      <p className={`font-serif text-[14.5px] leading-[1.7] ${tone}`}>
        {label && (
          <span className="mr-2 align-middle font-sans text-[10px] font-medium tracking-[0.14em] text-accent/80 uppercase">
            {label}
            {note.kind === 'investigation' && note.prompt ? ` · ${note.prompt}` : ''}
          </span>
        )}
        {note.body}
        {live && <span className="ml-0.5 inline-block animate-pulse text-accent">▍</span>}
        {note.id && onDelete && (
          <button
            onClick={() => onDelete(note.id!)}
            className="ml-2 align-middle font-sans text-[10px] text-faint opacity-0 transition group-hover:opacity-100 hover:text-[var(--del-fg)]"
          >
            delete
          </button>
        )}
      </p>
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

// Claude's voice: an editor's margin annotation (serif), plus an ask box that
// streams a live answer. Empty question = "explain this chunk".
export function AiCommentary({
  notes,
  streaming,
  busy,
  error,
  askRef,
  onAsk,
  onDeleteNote,
  subject = 'chunk',
}: {
  notes: DisplayNote[];
  streaming: { kind: AiNoteKind; text: string } | null;
  busy: boolean;
  error: string | null;
  askRef: RefObject<HTMLInputElement | null>;
  onAsk: (question: string) => void;
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
    <section className="thin-scroll max-h-[34%] shrink-0 overflow-auto border-t border-edge bg-surface/60">
      <div className="shell py-4">
        <div className="mb-2.5 flex items-center gap-3">
          <span className="text-accent" aria-hidden>
            ✦
          </span>
          <span className="font-sans text-[10px] font-semibold tracking-[0.22em] text-muted uppercase">
            Claude
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
          </form>
        </div>

        {error && (
          <ErrorBanner className="mb-2">{error}</ErrorBanner>
        )}

        <div className="space-y-2 border-l border-accent/35 pl-4">
          {notes.map((n, i) => (
            <Note key={n.id ?? `mock-${i}`} note={n} onDelete={onDeleteNote} />
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
