import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  fetchReview,
  fetchState,
  postAction,
  streamClaude,
  OVERVIEW_ID,
  type Action,
  type AiNoteKind,
  type Review,
  type ReviewState,
} from './api.ts';
import { ReviewsMenu } from './components/ReviewsMenu.tsx';
import { Splash } from './components/Splash.tsx';
import type { Anchor } from './diff.ts';
import type { DisplayNote } from './components/AiCommentary.tsx';
import { TopNav } from './components/TopNav.tsx';
import { ChunkView } from './components/ChunkView.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { ResponseBar } from './components/ResponseBar.tsx';
import { HelpOverlay } from './components/HelpOverlay.tsx';
import { SubmitModal } from './components/SubmitModal.tsx';
import { Logo } from './components/Logo.tsx';

const SLIDE = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -28 }),
};

const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgent);

export function App() {
  const [review, setReview] = useState<Review | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(-1); // -1 = overview page; 0..N-1 = chunks
  const [dir, setDir] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [streaming, setStreaming] = useState<{
    chunkId: string;
    kind: AiNoteKind;
    text: string;
  } | null>(null);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const claudeCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    Promise.all([fetchReview(), fetchState()])
      .then(([r, s]) => {
        setReview(r);
        setState(s);
        setLoaded(true);
        if (r) {
          const i = Number(new URLSearchParams(window.location.search).get('i'));
          if (Number.isInteger(i) && i >= 1 && i <= r.chunks.length)
            setIndex(i - 1);
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  const total = review?.chunks.length ?? 0;
  const chunk = index >= 0 ? review?.chunks[index] : undefined;
  const activeId = index < 0 ? OVERVIEW_ID : chunk?.id;

  // Clear the line anchor + any Claude error when the page changes.
  useEffect(() => {
    setAnchor(null);
    setClaudeError(null);
  }, [activeId]);

  const dispatch = useCallback(async (action: Action) => {
    const next = await postAction(action);
    setState(next);
  }, []);

  const jump = useCallback(
    (i: number) => {
      if (!total) return;
      const next = Math.max(-1, Math.min(total - 1, i)); // -1 = overview
      setDir(next >= index ? 1 : -1);
      setIndex(next);
    },
    [index, total],
  );
  const go = useCallback((delta: number) => jump(index + delta), [index, jump]);

  // Jump to the next/previous chunk NOT marked viewed (skipping read ones).
  const gotoUnviewed = useCallback(
    (delta: 1 | -1) => {
      if (!review || !state) return;
      const chunks = review.chunks;
      for (let i = index + delta; i >= 0 && i < chunks.length; i += delta) {
        if (!state.viewed.includes(chunks[i].id)) return jump(i);
      }
    },
    [review, state, index, jump],
  );

  const markViewedNext = useCallback(() => {
    if (!chunk) return;
    void dispatch({ type: 'set_viewed', chunk_id: chunk.id, viewed: true });
    if (index < total - 1) go(1);
  }, [chunk, dispatch, go, index, total]);

  const toggleFlag = useCallback(() => {
    if (!chunk) return;
    void dispatch({ type: 'toggle_flag', chunk_id: chunk.id });
  }, [chunk, dispatch]);

  const markUnread = useCallback(() => {
    if (!chunk) return;
    void dispatch({ type: 'set_viewed', chunk_id: chunk.id, viewed: false });
  }, [chunk, dispatch]);

  const submitComment = useCallback(() => {
    if (!chunk) return;
    const body = (drafts[chunk.id] ?? '').trim();
    if (!body) return;
    void dispatch({
      type: 'add_comment',
      chunk_id: chunk.id,
      side: anchor?.side ?? null,
      line: anchor?.line ?? null,
      body,
    });
    setDrafts((d) => ({ ...d, [chunk.id]: '' }));
    setAnchor(null);
  }, [anchor, chunk, dispatch, drafts]);

  const selectLine = useCallback((a: Anchor) => {
    setAnchor((cur) =>
      cur?.side === a.side && cur?.line === a.line ? null : a,
    );
    textareaRef.current?.focus();
  }, []);

  // Ask Claude about the current chunk (empty question → "explain"). One stream
  // at a time; it persists server-side on completion, so navigating away is safe.
  const askClaude = useCallback(
    (question: string) => {
      if (!activeId || streaming) return;
      setClaudeError(null);
      const kind: AiNoteKind = question.trim() ? 'investigation' : 'initial';
      setStreaming({ chunkId: activeId, kind, text: '' });
      claudeCloseRef.current = streamClaude(
        { chunkId: activeId, question },
        {
          onDelta: (t) =>
            setStreaming((s) => (s ? { ...s, text: s.text + t } : s)),
          onDone: (next) => {
            claudeCloseRef.current = null;
            setState(next);
            setStreaming(null);
          },
          onError: (msg) => {
            claudeCloseRef.current = null;
            setClaudeError(msg);
            setStreaming(null);
          },
        },
      );
    },
    [activeId, streaming],
  );

  // Keyboard navigation (ignored while typing in the comment box).
  //   → / j / n      : advance WITHOUT marking viewed (just navigate)
  //   ⌘→ / ⌘← (Ctrl) : jump to next/prev chunk NOT marked viewed
  //   ↵ Return       : mark viewed + advance (dirties the chunk)
  //   esc            : mark the current chunk unread (does not navigate)
  //   ← / k / p      : back   ·   f flag   ·   c comment   ·   ? help
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;

      if (submitOpen) {
        if (e.key === 'Escape') setSubmitOpen(false);
        return;
      }
      if (reviewsOpen) {
        if (e.key === 'Escape') setReviewsOpen(false);
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      if (helpOpen) {
        if (e.key === 'Escape') setHelpOpen(false);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault(); // also stops ⌘→ browser "forward"
        if (mod) gotoUnviewed(1);
        else go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); // also stops ⌘← browser "back"
        if (mod) gotoUnviewed(-1);
        else go(-1);
      } else if (e.key === 'Enter') {
        if (tag === 'BUTTON') return; // let a focused button handle its own click
        e.preventDefault();
        if (index < 0)
          go(1); // overview → begin review
        else markViewedNext();
      } else if (e.key === 'Escape') markUnread();
      else if (e.key === 'n' || e.key === 'j') go(1);
      else if (e.key === 'p' || e.key === 'k') go(-1);
      else if (e.key === 'f') toggleFlag();
      else if (e.key === 'c') {
        e.preventDefault();
        textareaRef.current?.focus();
      } else if (e.key === 'a') {
        e.preventDefault();
        askRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    go,
    gotoUnviewed,
    toggleFlag,
    markViewedNext,
    markUnread,
    helpOpen,
    submitOpen,
    reviewsOpen,
    index,
  ]);

  const commentedIds = useMemo(
    () => [...new Set((state?.comments ?? []).map((c) => c.chunk_id))],
    [state],
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-bg font-mono text-[var(--del-fg)]">
        Error: {error}
      </div>
    );
  }
  if (!review || !state) {
    if (loaded) {
      return (
        <Splash
          onOpened={(r, s) => {
            setReview(r);
            setState(s);
          }}
        />
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-bg">
        <Logo className="h-20 w-auto text-fg/80" />
        <span className="font-mono text-[12px] text-muted">
          Loading<span className="animate-pulse">…</span>
        </span>
      </div>
    );
  }

  const chunkComments = chunk
    ? state.comments.filter((c) => c.chunk_id === chunk.id)
    : [];
  const isFlagged = chunk ? state.flagged.includes(chunk.id) : false;
  const isViewed = chunk ? state.viewed.includes(chunk.id) : false;

  const storedNotes = (id: string): DisplayNote[] =>
    state.notes
      .filter((n) => n.chunk_id === id)
      .map((n) => ({
        id: n.id,
        kind: n.kind,
        prompt: n.prompt,
        body: n.body,
        suggested_action: n.suggested_action,
      }));

  // Overview page → notes for OVERVIEW_ID; chunk page → mock notes + stored notes.
  const displayNotes: DisplayNote[] = chunk
    ? [
        ...(chunk.ai_notes ?? []).map((n) => ({
          kind: n.kind,
          prompt: n.prompt,
          body: n.body,
          suggested_action: n.suggested_action,
        })),
        ...storedNotes(chunk.id),
      ]
    : storedNotes(OVERVIEW_ID);
  const aiPanel = {
    notes: displayNotes,
    streaming: streaming?.chunkId === activeId ? streaming : null,
    busy: streaming?.chunkId === activeId,
    error: claudeError,
    askRef,
    onAsk: askClaude,
    onDeleteNote: (id: string) => void dispatch({ type: 'delete_note', id }),
  };

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <TopNav
        pr={review.pr}
        meta={review.meta}
        chunks={review.chunks}
        index={index}
        viewed={state.viewed}
        flagged={state.flagged}
        commented={commentedIds}
        commentCount={state.comments.length}
        submitted={!!state.submitted}
        onJump={jump}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenReviews={() => setReviewsOpen(true)}
        onSubmit={() => setSubmitOpen(true)}
      />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={activeId}
            custom={dir}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            {chunk ? (
              <ChunkView
                chunk={chunk}
                flagged={isFlagged}
                comments={chunkComments}
                anchor={anchor}
                onSelectLine={selectLine}
                onDeleteComment={(id) =>
                  void dispatch({ type: 'delete_comment', id })
                }
                ai={aiPanel}
              />
            ) : (
              <OverviewView
                pr={review.pr}
                meta={review.meta}
                jira={review.overview.jira}
                ai={aiPanel}
                onBegin={() => jump(0)}
                chunkCount={total}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {chunk && (
        <ResponseBar
          draft={drafts[chunk.id] ?? ''}
          onDraft={(text) => setDrafts((d) => ({ ...d, [chunk.id]: text }))}
          anchor={anchor}
          onClearAnchor={() => setAnchor(null)}
          flagged={isFlagged}
          viewed={isViewed}
          textareaRef={textareaRef}
          canPrev={index > -1}
          canNext={index < total - 1}
          onComment={submitComment}
          onFlag={toggleFlag}
          onAskAi={() => askRef.current?.focus()}
          onMarkViewed={markViewedNext}
          onMarkUnread={markUnread}
          onNext={() => go(1)}
          onPrev={() => go(-1)}
          isMac={IS_MAC}
        />
      )}

      <HelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        isMac={IS_MAC}
      />
      <ReviewsMenu
        open={reviewsOpen}
        currentPr={review.pr}
        onClose={() => setReviewsOpen(false)}
        onSwitched={(nextReview, nextState) => {
          claudeCloseRef.current?.();
          claudeCloseRef.current = null;
          setReview(nextReview);
          setState(nextState);
          setIndex(-1);
          setDir(1);
          setDrafts({});
          setAnchor(null);
          setStreaming(null);
          setClaudeError(null);
        }}
        onCleared={() => {
          claudeCloseRef.current?.();
          claudeCloseRef.current = null;
          setReview(null);
          setState(null);
          setReviewsOpen(false);
          setStreaming(null);
          setClaudeError(null);
        }}
      />
      <SubmitModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        chunks={review.chunks}
        state={state}
        onSubmitted={setState}
      />
    </div>
  );
}
