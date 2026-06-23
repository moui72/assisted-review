import { vi } from 'vitest';
import { extractIssueKeys, buildJiraContext } from '../src/jira';

// ----- extractIssueKeys -----

describe('extractIssueKeys', () => {
  it('extracts a Jira key from a string', () => {
    expect(extractIssueKeys('Fixes FEN-2622')).toEqual(['FEN-2622']);
  });

  it('extracts multiple keys from multiple text sources', () => {
    const keys = extractIssueKeys('PROJ-1 and PROJ-2', 'feat/PROJ-3-branch');
    expect(keys).toContain('PROJ-1');
    expect(keys).toContain('PROJ-2');
    expect(keys).toContain('PROJ-3');
  });

  it('deduplicates keys that appear more than once', () => {
    expect(extractIssueKeys('PROJ-1', 'also PROJ-1')).toEqual(['PROJ-1']);
  });

  it('skips null and undefined texts', () => {
    expect(extractIssueKeys(null, undefined, 'PROJ-1')).toEqual(['PROJ-1']);
  });

  it('returns empty array when no keys found', () => {
    expect(extractIssueKeys('nothing here')).toEqual([]);
  });

  it('does not match single-letter project codes', () => {
    expect(extractIssueKeys('A-1 is not a key')).toEqual([]);
  });

  it('matches two-letter project codes', () => {
    expect(extractIssueKeys('AB-1')).toEqual(['AB-1']);
  });

  it('matches alphanumeric project codes', () => {
    expect(extractIssueKeys('FE2-999')).toEqual(['FE2-999']);
  });
});

// ----- buildJiraContext -----

const CREDS = {
  JIRA_BASE_URL: 'https://example.atlassian.net',
  JIRA_USER: 'user@example.com',
  JIRA_TOKEN: 'raw-token',
};

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of Object.keys(CREDS)) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

function setCreds(overrides: Partial<typeof CREDS> = {}) {
  Object.assign(process.env, { ...CREDS, ...overrides });
}

function clearCreds() {
  delete process.env.JIRA_BASE_URL;
  delete process.env.JIRA_USER;
  delete process.env.JIRA_TOKEN;
}

describe('buildJiraContext', () => {
  it('returns unavailable when credentials are missing', async () => {
    clearCreds();
    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.available).toBe(false);
    expect(ctx.reason).toMatch(/not configured/);
    expect(ctx.setup_hint).toBeDefined();
  });

  it('returns unavailable when token resolution fails', async () => {
    setCreds({ JIRA_TOKEN: 'env:_JIRA_NONEXISTENT_VAR_12345' });
    delete process.env._JIRA_NONEXISTENT_VAR_12345;
    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.available).toBe(false);
    expect(ctx.reason).toMatch(/JIRA_TOKEN resolution failed/);
  });

  it('returns available with empty issues when no keys provided', async () => {
    setCreds();
    const ctx = await buildJiraContext([]);
    expect(ctx.available).toBe(true);
    expect(ctx.issues).toEqual([]);
  });

  it('returns issues when fetch succeeds', async () => {
    setCreds();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        key: 'PROJ-1',
        fields: {
          summary: 'My story',
          status: { name: 'In Progress' },
          issuetype: { name: 'Story' },
          description: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'desc' }] }],
          },
          parent: undefined,
          customfield_10008: undefined,
        },
      }),
    } as Response);

    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.available).toBe(true);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].key).toBe('PROJ-1');
    expect(ctx.issues[0].summary).toBe('My story');
    expect(ctx.issues[0].status).toBe('In Progress');
    expect(ctx.issues[0].description).toContain('desc');
  });

  it('returns unavailable when all fetches fail (non-ok)', async () => {
    setCreds();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.available).toBe(false);
    expect(ctx.reason).toMatch(/Could not fetch/);
  });

  it('returns unavailable when fetch throws', async () => {
    setCreds();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.available).toBe(false);
  });

  it('fetches the epic when an issue has a parent key', async () => {
    setCreds();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const key = typeof url === 'string' && url.includes('EPIC-1') ? 'EPIC-1' : 'PROJ-1';
      const parentField = key === 'PROJ-1' ? { key: 'EPIC-1' } : undefined;
      return {
        ok: true,
        json: async () => ({
          key,
          fields: {
            summary: key === 'EPIC-1' ? 'The Epic' : 'The Story',
            status: { name: 'Open' },
            issuetype: { name: key === 'EPIC-1' ? 'Epic' : 'Story' },
            description: null,
            parent: parentField,
            customfield_10008: undefined,
          },
        }),
      } as Response;
    });

    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.available).toBe(true);
    expect(ctx.epic).toBeDefined();
    expect(ctx.epic!.key).toBe('EPIC-1');
    expect(ctx.epic!.summary).toBe('The Epic');
  });

  it('uses customfield for epic_key when set', async () => {
    setCreds();
    process.env.JIRA_EPIC_FIELD = 'customfield_99999';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const key = typeof url === 'string' && url.includes('EPIC-9') ? 'EPIC-9' : 'PROJ-1';
      return {
        ok: true,
        json: async () => ({
          key,
          fields: {
            summary: key === 'EPIC-9' ? 'Epic summary' : 'Story summary',
            status: { name: 'Open' },
            issuetype: { name: 'Story' },
            description: null,
            parent: undefined,
            customfield_99999: key === 'PROJ-1' ? 'EPIC-9' : undefined,
          },
        }),
      } as Response;
    });

    const ctx = await buildJiraContext(['PROJ-1']);
    expect(ctx.epic?.key).toBe('EPIC-9');
    delete process.env.JIRA_EPIC_FIELD;
  });

  it('strips trailing slash from JIRA_BASE_URL', async () => {
    setCreds({ JIRA_BASE_URL: 'https://example.atlassian.net/' });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await buildJiraContext(['PROJ-1']);
    const calledUrl = spy.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain('//rest');
  });

  it('covers ADF hardBreak, bulletList, orderedList, blockquote, heading nodes', async () => {
    setCreds();
    const adfDescription = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Para' }, { type: 'hardBreak' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'text', text: 'item 1' }] },
          ],
        },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'text', text: 'item 2' }] },
          ],
        },
        { type: 'blockquote', content: [{ type: 'text', text: 'quoted' }] },
        { type: 'unknownNode', content: [{ type: 'text', text: 'fallback' }] },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        key: 'PROJ-2',
        fields: {
          summary: 'ADF test',
          status: { name: 'Open' },
          issuetype: { name: 'Story' },
          description: adfDescription,
          parent: undefined,
          customfield_10008: undefined,
        },
      }),
    } as Response);

    const ctx = await buildJiraContext(['PROJ-2']);
    expect(ctx.available).toBe(true);
    const desc = ctx.issues[0].description;
    expect(desc).toContain('Title');
    expect(desc).toContain('Para');
    expect(desc).toContain('item 1');
    expect(desc).toContain('item 2');
    expect(desc).toContain('quoted');
    expect(desc).toContain('fallback');
  });
});
