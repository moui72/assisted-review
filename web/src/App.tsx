import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  errMsg,
  fetchReview,
  fetchState,
  fetchConfig,
  postAction,
  streamClaude,
  OVERVIEW_ID,
  type Action,
  type AiNoteKind,
  type PreloadConfig,
  type Review,
  type ReviewState,
  type StoredNote,
} from './api.ts';
import { findNextPreload } from './preload.ts';
import { ReviewsMenu } from './components/ReviewsMenu.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { Splash } from './components/Splash.tsx';
import type { Anchor } from './diff.ts';
import { TopNav } from './components/TopNav.tsx';
import { ChunkView } from './components/ChunkView.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { ResponseBar } from './components/ResponseBar.tsx';
import { HelpOverlay } from './components/HelpOverlay.tsx';
import { SubmitModal } from './components/SubmitModal.tsx';
import { Logo } from './components/Logo.tsx';
import { detectMac } from './os.ts';

const SLIDE = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -28 }),
};

const IS_MAC = detectMac();


export function App() {
  const [review, setReview] = useState<Review | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(-1); // -1 = overview page; 0..N-1 = chunks
  const [dir, setDir] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  // Set when the reviewer clicked "Re-anchor" on a displaced comment from the
  // Overview page — the next line picked in ChunkView dispatches
  // reanchor_comment for this comment instead of a normal anchor selection.
  const [reanchoring, setReanchoring] = useState<{ id: string; body: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streaming, setStreaming] = useState<{
    chunkId: string;
    kind: AiNoteKind;
    text: string;
  } | null>(null);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [preloadTargetId, setPreloadTargetId] = useState<string | null>(null);
  const [preloadConfig, setPreloadConfig] = useState<PreloadConfig | null>(null);
  const [preloadTick, setPreloadTick] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const claudeCloseRef = useRef<(() => void) | null>(null);
  const preloadCancelRef = useRef<(() => void) | null>(null);
  const preloadAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchConfig().then((serverCfg) => {
      const storedChunks = localStorage.getItem('ar-preload-chunks');
      const storedOverview = localStorage.getItem('ar-preload-overview');
      setPreloadConfig({
        preload_chunks: storedChunks !== null ? Number(storedChunks) : serverCfg.preload_chunks,
        preload_overview: storedOverview !== null ? storedOverview !== 'false' : serverCfg.preload_overview,
      });
    }).catch(() => {});
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
        setError(errMsg(e)),
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

  // Background preloading: silently request Claude notes for upcoming chunks one at a time.
  // Driven by navigation (index), state changes (completed preloads), and preloadTick (errors).
  useEffect(() => {
    if (!review || !state || !preloadConfig || streaming || preloadCancelRef.current) return;

    const next = findNextPreload(review, state, index, preloadConfig, preloadAttemptedRef.current);
    if (!next) return;

    preloadAttemptedRef.current.add(next);
    setPreloadTargetId(next);
    const cancel = streamClaude(
      { chunkId: next, question: '' },
      {
        onDelta: () => {},
        onDone: (nextState) => {
          preloadCancelRef.current = null;
          setPreloadTargetId(null);
          setState(nextState);
        },
        onError: () => {
          preloadCancelRef.current = null;
          setPreloadTargetId(null);
          setPreloadTick((t) => t + 1);
        },
      },
    );
    preloadCancelRef.current = cancel;
    return () => {
      cancel();
      preloadCancelRef.current = null;
      setPreloadTargetId(null);
    };
  }, [review, state, index, preloadConfig, streaming, preloadTick]);

  const handlePreloadChange = useCallback((cfg: PreloadConfig) => {
    localStorage.setItem('ar-preload-chunks', String(cfg.preload_chunks));
    localStorage.setItem('ar-preload-overview', String(cfg.preload_overview));
    setPreloadConfig(cfg);
    preloadAttemptedRef.current = new Set();
  }, []);

  const cancelInFlight = useCallback(() => {
    claudeCloseRef.current?.();
    claudeCloseRef.current = null;
    preloadCancelRef.current?.();
    preloadCancelRef.current = null;
    preloadAttemptedRef.current = new Set();
  }, []);

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
    void dispatch({
      type: 'toggle_flag',
      chunk_id: chunk.id,
      file: chunk.file,
      hunk_header: chunk.hunk_header,
    });
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
      file: chunk.file,
      hunk_header: chunk.hunk_header,
    });
    setDrafts((d) => ({ ...d, [chunk.id]: '' }));
    setAnchor(null);
  }, [anchor, chunk, dispatch, drafts]);

  const selectLine = useCallback((a: Anchor) => {
    if (reanchoring && chunk) {
      void dispatch({
        type: 'reanchor_comment',
        id: reanchoring.id,
        chunk_id: chunk.id,
        side: a.side,
        line: a.line,
        file: chunk.file,
        hunk_header: chunk.hunk_header,
      });
      setReanchoring(null);
      return;
    }
    setAnchor((cur) =>
      cur?.side === a.side && cur?.line === a.line ? null : a,
    );
    textareaRef.current?.focus();
  }, [reanchoring, chunk, dispatch]);

  const startReanchor = useCallback(
    (comment: { id: string; body: string }) => {
      setAnchor(null);
      setReanchoring({ id: comment.id, body: comment.body });
      jump(0);
    },
    [jump],
  );

  const cancelReanchor = useCallback(() => setReanchoring(null), []);

  // Ask Claude about the current chunk (empty question → "explain"). One stream
  // at a time; it persists server-side on completion, so navigating away is safe.
  const askClaude = useCallback(
    (question: string) => {
      if (!activeId || streaming) return;
      preloadCancelRef.current?.();
      preloadCancelRef.current = null;
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
      if (settingsOpen) {
        if (e.key === 'Escape') setSettingsOpen(false);
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
    settingsOpen,
    index,
  ]);

  const commentedIds = useMemo(
    () => [
      ...new Set(
        (state?.comments ?? []).filter((c) => !c.displaced).map((c) => c.chunk_id),
      ),
    ],
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

  // Displaced entries keep their last-known chunk_id, which may now
  // (mis)match a completely different chunk after renumbering — only
  // non-displaced entries are trustworthy for chunk-scoped lookups.
  // Displaced comments/notes/flags are shown exclusively in the Overview
  // page's Displaced section.
  const chunkComments = chunk
    ? state.comments.filter((c) => c.chunk_id === chunk.id && !c.displaced)
    : [];
  const isFlagged = chunk
    ? state.flagged.some((f) => f.chunk_id === chunk.id && !f.displaced)
    : false;
  const isViewed = chunk ? state.viewed.includes(chunk.id) : false;

  const storedNotes = (id: string): StoredNote[] =>
    state.notes.filter((n) => n.chunk_id === id && !n.displaced);

  const displacedComments = state.comments.filter((c) => c.displaced);
  const displacedNotes = state.notes.filter((n) => n.displaced);
  const displacedFlags = state.flagged.filter((f) => f.displaced);

  // Overview page → notes for OVERVIEW_ID; chunk page → mock notes + stored notes.
  const displayNotes: StoredNote[] = chunk
    ? [...(chunk.ai_notes ?? []), ...storedNotes(chunk.id)]
    : storedNotes(OVERVIEW_ID);
  // Mock notes carry a fake id but were never written to ReviewState.notes —
  // only real, persisted notes are safe to delete.
  const deletableNoteIds = new Set(state.notes.map((n) => n.id));
  const aiPanel = {
    notes: displayNotes,
    deletableNoteIds,
    streaming: streaming?.chunkId === activeId ? streaming : null,
    busy: streaming?.chunkId === activeId || preloadTargetId === activeId,
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
        flagged={state.flagged.filter((f) => !f.displaced).map((f) => f.chunk_id)}
        commented={commentedIds}
        commentCount={state.comments.length}
        submitted={!!state.submitted}
        onJump={jump}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenReviews={() => setReviewsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
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
                onUpdateComment={(id, body) =>
                  void dispatch({ type: 'update_comment', id, body })
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
                displacedComments={displacedComments}
                displacedNotes={displacedNotes}
                displacedFlags={displacedFlags}
                onReanchorComment={startReanchor}
                onDeleteComment={(id) =>
                  void dispatch({ type: 'delete_comment', id })
                }
                onDeleteNote={(id) => void dispatch({ type: 'delete_note', id })}
                onUnflag={(f) =>
                  void dispatch({
                    type: 'toggle_flag',
                    chunk_id: f.chunk_id,
                    file: f.file,
                    hunk_header: f.hunk_header,
                  })
                }
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
          reanchoring={reanchoring}
          onCancelReanchor={cancelReanchor}
        />
      )}

      <HelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        isMac={IS_MAC}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preloadConfig={preloadConfig}
        onPreloadChange={handlePreloadChange}
      />
      <ReviewsMenu
        open={reviewsOpen}
        currentPr={review.pr}
        onClose={() => setReviewsOpen(false)}
        onSwitched={(nextReview, nextState) => {
          cancelInFlight();
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
          cancelInFlight();
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
