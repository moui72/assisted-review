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

describe('OverviewView', () => {
  it('renders an empty-state message and no Begin Review button when there are zero chunks', () => {
    const onBegin = vi.fn();
    render(
      <OverviewView pr={pr} meta={meta} jira={jira} ai={ai} onBegin={onBegin} chunkCount={0} />,
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
      />,
    );
    expect(screen.getByText('No reviewable changes in this MR.')).toBeInTheDocument();
  });

  it('renders the chunk count and a working Begin Review button when chunks exist', async () => {
    const user = userEvent.setup();
    const onBegin = vi.fn();
    render(
      <OverviewView pr={pr} meta={meta} jira={jira} ai={ai} onBegin={onBegin} chunkCount={3} />,
    );
    expect(screen.getByText('Review 3 chunks one at a time.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /begin review/i });
    await user.click(button);
    expect(onBegin).toHaveBeenCalledTimes(1);
  });
});
