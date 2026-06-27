import { createServer } from 'node:http';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';

const MR_SHA = 'abc123def456abc123def456abc123def456abc123';
const MR_URL = 'https://gitlab.com/testgroup/testrepo/-/merge_requests/42';

export const MOCK_GITLAB_PORT = 4330;

function drainAndRespond(req: IncomingMessage, res: ServerResponse, body: unknown): void {
  req.resume();
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  });
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const urlPath = (req.url ?? '').split('?')[0];
  const method = req.method ?? 'GET';

  res.setHeader('Content-Type', 'application/json');

  if (urlPath.endsWith('/diffs')) {
    res.end(JSON.stringify([{
      old_path: 'lib/helper.rb',
      new_path: 'lib/helper.rb',
      diff: '@@ -10,3 +10,4 @@\n def process(data)\n-  data.strip\n+  result = data.strip\n+  result\n end\n',
      new_file: false,
      deleted_file: false,
    }]));
  } else if (urlPath.endsWith('/approve') && method === 'POST') {
    drainAndRespond(req, res, { id: 1, approved: true });
  } else if (urlPath.endsWith('/notes') && method === 'POST') {
    drainAndRespond(req, res, { id: 1 });
  } else if (urlPath.endsWith('/discussions') && method === 'POST') {
    drainAndRespond(req, res, { id: '1' });
  } else if (urlPath.endsWith('/versions')) {
    res.end(JSON.stringify([{
      base_commit_sha: 'base0000000000000000000000000000000000000',
      start_commit_sha: 'start000000000000000000000000000000000000',
      head_commit_sha: MR_SHA,
    }]));
  } else if (urlPath.endsWith('/commits')) {
    res.end(JSON.stringify([{ id: MR_SHA }]));
  } else if (urlPath.endsWith('/merge_requests/42')) {
    res.end(JSON.stringify({
      title: 'E2E Test MR',
      author: { username: 'testuser' },
      target_branch: 'main',
      source_branch: 'feat/e2e-test',
      draft: false,
      web_url: MR_URL,
      sha: MR_SHA,
      description: 'Test merge request for e2e testing',
    }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: `Not found: ${method} ${urlPath}` }));
  }
}

/**
 * Start the mock GitLab REST API server. Returns null if port is already in use
 * (prior run's server still running — safe to ignore for local reruns).
 */
export async function startMockGitLabApi(): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer(handleRequest);
    server.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        resolve(null);
      } else {
        throw err;
      }
    });
    server.listen(MOCK_GITLAB_PORT, '127.0.0.1', () => resolve(server));
  });
}
