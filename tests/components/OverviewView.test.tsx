// @vitest-environment jsdom
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { OverviewView } from '../../web/src/components/OverviewView.tsx';
import type { AiPanelProps } from '../../web/src/components/ChunkView.tsx';
import type { JiraContext, PrMeta, PrRef } from '../../web/src/api.ts';

const pr: PrRef = { owner: 'alice', repo: 'proj', number: 1, platform: 'github' };

const meta: PrMeta = {
  title: 'Add feature',
  author: 'alice',
  base_ref: 'main',
  head_ref: 'feature',
  is_draft: false,
  url: 'https://github.com/alice/proj/pull/1',
  head_sha: 'abc123',
  body: '',
};

const jira: JiraContext = { available: false, keys: [], issues: [] };

const ai: AiPanelProps = {
  notes: [],
  streaming: null,
  busy: false,
  error: null,
  askRef: createRef<HTMLInputElement>(),
  onAsk: vi.fn(),
  onDeleteNote: vi.fn(),
};

// No displaced comments/notes/flags by default — Displaced Comments tests
// below cover that section explicitly.
const noDisplaced = {
  displacedComments: [],
  displacedNotes: [],
  displacedFlags: [],
  onReanchorComment: vi.fn(),
  onDeleteComment: vi.fn(),
  onDeleteNote: vi.fn(),
  onUnflag: vi.fn(),
};

describe('OverviewView', () => {
  it('renders an empty-state message and no Begin Review button when there are zero chunks', () => {
    const onBegin = vi.fn();
    render(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={onBegin}
        chunkCount={0}
        {...noDisplaced}
      />,
    );
    expect(screen.getByText('No reviewable changes in this PR.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /begin review/i })).not.toBeInTheDocument();
  });

  it('labels the empty-state message MR for a GitLab review', () => {
    render(
      <OverviewView
        pr={{ ...pr, platform: 'gitlab' }}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={vi.fn()}
        chunkCount={0}
        {...noDisplaced}
      />,
    );
    expect(screen.getByText('No reviewable changes in this MR.')).toBeInTheDocument();
  });

  it('renders the chunk count and a working Begin Review button when chunks exist', async () => {
    const user = userEvent.setup();
    const onBegin = vi.fn();
    render(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={onBegin}
        chunkCount={3}
        {...noDisplaced}
      />,
    );
    expect(screen.getByText('Review 3 chunks one at a time.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /begin review/i });
    await user.click(button);
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it('shows Stop while the summary is streaming', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={{ ...ai, streaming: { kind: 'initial', text: 'partial' }, busy: true, onStop }}
        onBegin={vi.fn()}
        chunkCount={3}
        {...noDisplaced}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'stop' }));

    expect(onStop).toHaveBeenCalledOnce();
  });

  it('shows "Begin review" with no viewed chunks and "Resume review" once any chunk is viewed', () => {
    const { rerender } = render(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={vi.fn()}
        chunkCount={3}
        hasViewed={false}
        {...noDisplaced}
      />,
    );
    expect(screen.getByRole('button', { name: 'Begin review →' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume review/i })).not.toBeInTheDocument();

    rerender(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={vi.fn()}
        chunkCount={3}
        hasViewed={true}
        {...noDisplaced}
      />,
    );
    expect(screen.getByRole('button', { name: 'Resume review →' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /begin review/i })).not.toBeInTheDocument();
    expect(screen.getByText('Pick up where you left off.')).toBeInTheDocument();
  });

  it('renders a displaced comment with re-anchor and delete actions, and none when there are none', () => {
    const onReanchorComment = vi.fn();
    const onDeleteComment = vi.fn();
    const displacedComment = {
      id: 'cm1',
      chunk_id: 'c1',
      side: 'RIGHT' as const,
      line: 3,
      body: 'still relevant?',
      file: 'a.ts',
      hunk_header: '@@ -1,3 +1,3 @@',
      displaced: true,
      created_at: 't',
      updated_at: 't',
    };
    render(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={vi.fn()}
        chunkCount={3}
        {...noDisplaced}
        displacedComments={[displacedComment]}
        onReanchorComment={onReanchorComment}
        onDeleteComment={onDeleteComment}
      />,
    );
    expect(screen.getByText('Displaced comments')).toBeInTheDocument();
    expect(screen.getByText('still relevant?')).toBeInTheDocument();
    screen.getByRole('button', { name: /re-anchor/i }).click();
    expect(onReanchorComment).toHaveBeenCalledWith(displacedComment);
    screen.getByRole('button', { name: /delete/i }).click();
    expect(onDeleteComment).toHaveBeenCalledWith('cm1');
  });

  it('does not render the Displaced Comments section when nothing is displaced', () => {
    render(
      <OverviewView
        pr={pr}
        meta={meta}
        jira={jira}
        ai={ai}
        onBegin={vi.fn()}
        chunkCount={3}
        {...noDisplaced}
      />,
    );
    expect(screen.queryByText('Displaced comments')).not.toBeInTheDocument();
  });
});
