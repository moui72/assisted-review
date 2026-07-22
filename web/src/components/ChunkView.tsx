import type { RefObject } from 'react';
import type { AiNoteKind, Chunk, DraftComment, StoredNote } from '../api.ts';
import { lineSpan, type Anchor } from '../diff.ts';
import { DiffPane } from './DiffPane.tsx';
import { AiCommentary } from './AiCommentary.tsx';

export interface AiPanelProps {
  notes: StoredNote[];
  deletableNoteIds: Set<string>;
  streaming: { kind: AiNoteKind; text: string } | null;
  busy: boolean;
  error: string | null;
  askRef: RefObject<HTMLInputElement | null>;
  onAsk: (question: string) => void;
  onStop?: () => void;
  onDeleteNote: (id: string) => void;
}

// One chunk page: fixed file header, scrollable diff, pinned AI annotation.
export function ChunkView({
  chunk,
  flagged,
  comments,
  anchor,
  onSelectLine,
  onDeleteComment,
  onUpdateComment,
  ai,
}: {
  chunk: Chunk;
  flagged: boolean;
  comments: DraftComment[];
  anchor: Anchor | null;
  onSelectLine: (a: Anchor) => void;
  onDeleteComment: (id: string) => void;
  onUpdateComment: (id: string, body: string) => void;
  ai: AiPanelProps;
}) {
  const dir = chunk.file.split('/').slice(0, -1).join('/');
  const name = chunk.file.split('/').pop() ?? chunk.file;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-edge bg-surface/40">
        <div className="shell flex items-baseline gap-3 py-3">
          <div className="min-w-0 font-mono text-[13px]">
            {dir && <span className="text-faint">{dir}/</span>}
            <span className="font-medium text-fg">{name}</span>
          </div>
          <span className="font-mono text-[12px] text-accent">{lineSpan(chunk)}</span>
          {chunk.context && (
            <span className="truncate font-mono text-[11px] text-faint">{chunk.context}</span>
          )}
          {flagged && (
            <span className="ml-auto shrink-0 rounded-sm border border-accent/40 px-2 py-0.5 font-sans text-[10px] font-medium tracking-[0.14em] text-accent uppercase">
              flagged
            </span>
          )}
        </div>
      </header>
      <DiffPane
        chunk={chunk}
        comments={comments}
        anchor={anchor}
        onSelectLine={onSelectLine}
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
      />
      <AiCommentary {...ai} />
    </div>
  );
}
