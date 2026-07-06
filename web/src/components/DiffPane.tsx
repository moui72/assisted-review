import { Fragment, useMemo, useState } from 'react';
import type { Chunk, DraftComment } from '../api.ts';
import { diffRows, type Anchor, type DiffRow } from '../diff.ts';
import { highlightLine, langFor } from '../highlight.ts';

const ROW_BG: Record<string, string> = {
  add: 'bg-[var(--add-bg)]',
  del: 'bg-[var(--del-bg)]',
  ctx: '',
};
const GUTTER: Record<string, string> = {
  add: 'bg-[var(--add-gutter)] text-[var(--add-fg)]',
  del: 'bg-[var(--del-gutter)] text-[var(--del-fg)]',
  ctx: 'text-faint',
};

// Context lines anchor to the new (RIGHT) side, matching GitHub.
function rowAnchor(r: DiffRow): Anchor | null {
  if (r.type === 'add' || r.type === 'ctx') return { side: 'RIGHT', line: r.newLn! };
  if (r.type === 'del') return { side: 'LEFT', line: r.oldLn! };
  return null;
}

function CommentCard({
  comment,
  onDelete,
  onUpdateComment,
  indented = false,
}: {
  comment: DraftComment;
  onDelete: (id: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  indented?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(comment.body);

  const startEditing = () => {
    setDraftBody(comment.body);
    setIsEditing(true);
  };
  const cancel = () => setIsEditing(false);
  const save = () => {
    onUpdateComment(comment.id, draftBody);
    setIsEditing(false);
  };
  const canSave = draftBody.trim().length > 0;

  return (
    <div
      className={`my-1 rounded-md border border-edge bg-surface-2 px-3 py-2 font-sans ${indented ? 'ml-[96px]' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] tracking-wide text-faint">you · draft</span>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={startEditing}
              className="text-[11px] text-faint transition hover:text-fg"
            >
              edit
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="text-[11px] text-faint transition hover:text-[var(--del-fg)]"
            >
              delete
            </button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div>
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel();
            }}
            autoFocus
            className="w-full resize-none rounded-md border border-edge bg-surface px-2 py-1.5 text-[13px] text-fg/90 outline-none focus:border-accent"
            rows={3}
          />
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <button
              onClick={cancel}
              className="rounded-md px-2.5 py-1 text-[11px] text-faint transition hover:text-fg"
            >
              cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-bg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            >
              save
            </button>
          </div>
        </div>
      ) : (
        <div className="text-[13px] whitespace-pre-wrap text-fg/90">{comment.body}</div>
      )}
    </div>
  );
}

// The diff is the only internally-scrolling region of a chunk page. Lines are
// clickable to anchor a comment; saved comments render inline beneath the line.
export function DiffPane({
  chunk,
  comments,
  anchor,
  onSelectLine,
  onDeleteComment,
  onUpdateComment,
}: {
  chunk: Chunk;
  comments: DraftComment[];
  anchor: Anchor | null;
  onSelectLine: (a: Anchor) => void;
  onDeleteComment: (id: string) => void;
  onUpdateComment: (id: string, body: string) => void;
}) {
  const lang = langFor(chunk.file);
  const rows = useMemo(() => diffRows(chunk.diff), [chunk.diff]);
  const wholeChunk = useMemo(() => comments.filter((c) => c.line === null), [comments]);
  const commentsByAnchor = useMemo(() => {
    const m = new Map<string, DraftComment[]>();
    for (const c of comments) {
      if (c.side && c.line !== null) {
        const key = `${c.side}-${c.line}`;
        const existing = m.get(key);
        if (existing) existing.push(c);
        else m.set(key, [c]);
      }
    }
    return m;
  }, [comments]);

  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-auto bg-bg">
      <div className="shell">
        <table className="w-full border-collapse font-mono text-[12.5px] leading-[1.65]">
          <tbody>
            {rows.map((r, i) => {
              if (r.type === 'hunk' || r.type === 'meta') {
                return (
                  <tr key={i} className="bg-[var(--hunk-bg)] text-faint select-none">
                    <td className="px-3 text-right" />
                    <td className="px-3 text-right" />
                    <td className="px-2" />
                    <td className="py-0.5 pr-4 text-[11px] tracking-wide whitespace-pre-wrap">
                      {r.text}
                    </td>
                  </tr>
                );
              }
              const a = rowAnchor(r)!;
              const selected = anchor?.side === a.side && anchor?.line === a.line;
              const lineComments = commentsByAnchor.get(`${a.side}-${a.line}`) ?? [];
              return (
                <Fragment key={i}>
                  <tr
                    onClick={() => onSelectLine(a)}
                    className={`cursor-pointer hover:bg-fg/[0.035] ${
                      selected
                        ? 'bg-accent/12 shadow-[inset_2px_0_0_var(--accent)]'
                        : ROW_BG[r.type]
                    }`}
                  >
                    <td
                      className={`w-[1%] min-w-[44px] border-r border-edge/60 px-3 text-right tabular-nums select-none ${GUTTER[r.type]}`}
                    >
                      {r.oldLn ?? ''}
                    </td>
                    <td
                      className={`w-[1%] min-w-[44px] border-r border-edge/60 px-3 text-right tabular-nums select-none ${GUTTER[r.type]}`}
                    >
                      {r.newLn ?? ''}
                    </td>
                    <td className={`w-[1%] px-2 text-center select-none ${GUTTER[r.type]}`}>
                      {r.sign?.trim()}
                    </td>
                    <td
                      className="pr-4 whitespace-pre-wrap text-fg/90"
                      dangerouslySetInnerHTML={{ __html: highlightLine(r.text, lang) }}
                    />
                  </tr>
                  {lineComments.map((c) => (
                    <tr key={c.id}>
                      <td colSpan={4}>
                        <CommentCard
                          comment={c}
                          onDelete={onDeleteComment}
                          onUpdateComment={onUpdateComment}
                          indented
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {wholeChunk.length > 0 && (
          <div className="mt-3 mb-1">
            <div className="mb-1.5 font-sans text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
              on this chunk
            </div>
            <div className="space-y-1.5">
              {wholeChunk.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  onDelete={onDeleteComment}
                  onUpdateComment={onUpdateComment}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
