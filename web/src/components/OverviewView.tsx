import { useState } from 'react';
import type { JiraContext, JiraIssue, PrMeta, PrRef } from '../api.ts';
import type { AiPanelProps } from './ChunkView.tsx';
import { ErrorBanner } from './ErrorBanner.tsx';
import { Markdown } from './Markdown.tsx';

function JiraCard({ issue, epic }: { issue: JiraIssue; epic?: boolean }) {
  return (
    <div className="rounded-lg border border-edge bg-surface/50 p-4">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[12px]">
        {epic && (
          <span className="rounded-sm bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-violet-300 uppercase">
            epic
          </span>
        )}
        <a href={issue.url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
          {issue.key}
        </a>
        <span className="text-faint">
          {issue.type} · {issue.status}
        </span>
      </div>
      <div className="font-sans text-[14px] font-medium text-fg">{issue.summary}</div>
    </div>
  );
}

function JiraSection({ jira }: { jira: JiraContext }) {
  if (!jira.available) {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/[0.06] p-4">
        <div className="mb-1 flex items-center gap-2 font-sans text-[13px] font-semibold text-accent">
          <span aria-hidden>⚠</span> Claude can't access Jira
        </div>
        {jira.reason && <p className="font-sans text-[12.5px] text-fg/70">{jira.reason}.</p>}
        {jira.setup_hint && (
          <p className="mt-1.5 font-sans text-[12.5px] leading-relaxed text-muted">{jira.setup_hint}</p>
        )}
        {jira.keys.length > 0 && (
          <p className="mt-1.5 font-mono text-[12px] text-faint">Referenced: {jira.keys.join(', ')}</p>
        )}
      </div>
    );
  }
  if (jira.issues.length === 0) {
    return (
      <p className="font-sans text-[13px] text-faint italic">
        No linked Jira issues found in the title, branch, or description.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {jira.issues.map((i) => (
        <JiraCard key={i.key} issue={i} />
      ))}
      {jira.epic && <JiraCard issue={jira.epic} epic />}
    </div>
  );
}

// The overview foregrounds the AI summary; the PR description is collapsed.
function Summary({ ai }: { ai: AiPanelProps }) {
  const [q, setQ] = useState('');
  const summary = ai.notes.find((n) => n.kind === 'initial');
  const qa = ai.notes.filter((n) => n.kind === 'investigation');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ai.busy) return;
    ai.onAsk(q);
    setQ('');
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-accent" aria-hidden>
          ✦
        </span>
        <span className="font-sans text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">
          Claude’s summary
        </span>
        <span className="h-px flex-1 bg-edge" />
        {summary?.id && (
          <button
            onClick={() => ai.onDeleteNote(summary.id!)}
            className="font-sans text-[11px] text-faint transition hover:text-[var(--del-fg)]"
          >
            regenerate
          </button>
        )}
      </div>

      {ai.busy ? (
        <div className="text-[15px]">
          <Markdown>{ai.streaming?.text || ''}</Markdown>
          <span className="ml-0.5 inline-block animate-pulse text-accent">▍</span>
        </div>
      ) : summary ? (
        <Markdown className="text-[15px] leading-[1.75]">{summary.body}</Markdown>
      ) : (
        <button
          onClick={() => ai.onAsk('')}
          className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:brightness-110"
        >
          ✦ Summarize this PR
        </button>
      )}

      {ai.error && (
        <ErrorBanner className="mt-2">{ai.error}</ErrorBanner>
      )}

      {qa.length > 0 && (
        <div className="mt-4 space-y-3 border-l border-accent/30 pl-4">
          {qa.map((n) => (
            <div key={n.id ?? n.body}>
              <div className="font-sans text-[11px] font-medium tracking-wide text-accent/80">
                {n.prompt}
              </div>
              <Markdown className="mt-0.5 text-fg/80">{n.body}</Markdown>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 flex items-center gap-2">
        <input
          ref={ai.askRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={ai.busy}
          placeholder="Ask about this PR…  (a)"
          className="flex-1 rounded-md border border-edge bg-bg px-3 py-1.5 font-sans text-[13px] text-fg placeholder:text-faint focus:border-accent/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={ai.busy}
          className="rounded-md border border-edge-strong px-3 py-1.5 text-[12.5px] font-medium text-muted transition enabled:hover:border-fg/30 enabled:hover:text-fg disabled:opacity-40"
        >
          {ai.busy ? '…' : q.trim() ? 'Ask' : 'Summarize'}
        </button>
      </form>
    </section>
  );
}

function Collapsible({
  label,
  enabled = true,
  emptyHint,
  defaultOpen = false,
  children,
}: {
  label: string;
  enabled?: boolean;
  emptyHint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!enabled}
        className="flex items-center gap-2 font-sans text-[10px] font-semibold tracking-[0.2em] text-faint uppercase transition hover:text-muted disabled:opacity-60"
      >
        <span
          aria-hidden
          className={`inline-block text-[14px] leading-none transition-transform ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        {label}
        {!enabled && emptyHint && (
          <span className="ml-1 normal-case tracking-normal italic">— {emptyHint}</span>
        )}
      </button>
      {open && enabled && <div className="mt-2">{children}</div>}
    </section>
  );
}

export function OverviewView({
  pr,
  meta,
  jira,
  ai,
  onBegin,
  chunkCount,
}: {
  pr: PrRef;
  meta: PrMeta;
  jira: JiraContext;
  ai: AiPanelProps;
  onBegin: () => void;
  chunkCount: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="thin-scroll min-h-0 flex-1 overflow-auto">
        <div className="shell space-y-7 py-7">
          <header>
            <h1 className="text-[20px] leading-snug font-semibold text-fg">{meta.title}</h1>
            <div className="mt-1 font-mono text-[12px] text-faint">
              <a href={meta.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                {pr.owner}/{pr.repo}#{pr.number}
              </a>
              <span className="text-edge-strong"> · </span>
              {meta.author} · {meta.base_ref} ← {meta.head_ref}
              {meta.is_draft && <span className="ml-2 text-accent">draft</span>}
              <span className="text-edge-strong"> · </span>
              {chunkCount} chunks
            </div>
          </header>

          <Summary ai={ai} />

          <Collapsible
            label="GH PR description"
            enabled={meta.body.trim().length > 0}
            emptyHint="none"
          >
            <div className="rounded-lg border border-edge bg-surface/40 p-4 text-fg/85">
              <Markdown>{meta.body}</Markdown>
            </div>
          </Collapsible>

          <Collapsible label="Jira" defaultOpen>
            <JiraSection jira={jira} />
          </Collapsible>
        </div>
      </div>

      <footer className="shrink-0 border-t border-edge bg-surface">
        <div className="shell flex items-center justify-between py-3">
          <span className="font-sans text-[12px] text-faint">
            Review {chunkCount} chunks one at a time.
          </span>
          <button
            onClick={onBegin}
            className="rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-bg transition hover:brightness-110"
          >
            Begin review →
          </button>
        </div>
      </footer>
    </div>
  );
}
