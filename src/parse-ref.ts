import type { PrRef } from './types.js';

// Parse a PR reference into {owner, repo, number}.
// Accepts: "owner/repo#123" or a github.com PR URL.
export function parseRef(ref: string | undefined): PrRef {
  if (!ref || typeof ref !== 'string') {
    throw new Error('missing PR reference (expected owner/repo#N or a PR URL)');
  }
  const trimmed = ref.trim();

  // owner/repo#123
  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/#\s]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      number: Number(shortMatch[3]),
    };
  }

  // https://github.com/owner/repo/pull/123
  const urlMatch = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      number: Number(urlMatch[3]),
    };
  }

  throw new Error(
    `unrecognized PR reference: "${ref}" (expected owner/repo#N or a PR URL)`,
  );
}
