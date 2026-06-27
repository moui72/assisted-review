import type { PrRef } from './types.js';

// Parse a PR/MR reference into {owner, repo, number, platform}.
// GitHub accepts: "owner/repo#123" or a github.com PR URL.
// GitLab accepts: "namespace/repo!123" (namespace may contain slashes for nested groups)
//                 or a gitlab.com MR URL.
export function parseRef(ref: string | undefined): PrRef {
  if (!ref || typeof ref !== 'string') {
    throw new Error('missing PR reference (expected owner/repo#N or a PR URL)');
  }
  const trimmed = ref.trim();

  // owner/repo#123  (GitHub shorthand)
  const ghShortMatch = trimmed.match(/^([^/\s]+)\/([^/#!\s]+)#(\d+)$/);
  if (ghShortMatch) {
    return {
      owner: ghShortMatch[1],
      repo: ghShortMatch[2],
      number: Number(ghShortMatch[3]),
      platform: 'github',
    };
  }

  // namespace/repo!123  (GitLab shorthand — namespace may contain slashes)
  const glShortMatch = trimmed.match(/^(.+)\/([^/\s!#]+)!(\d+)$/);
  if (glShortMatch) {
    return {
      owner: glShortMatch[1],
      repo: glShortMatch[2],
      number: Number(glShortMatch[3]),
      platform: 'gitlab',
    };
  }

  // https://github.com/owner/repo/pull/123
  const ghUrlMatch = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/);
  if (ghUrlMatch) {
    return {
      owner: ghUrlMatch[1],
      repo: ghUrlMatch[2],
      number: Number(ghUrlMatch[3]),
      platform: 'github',
    };
  }

  // https://gitlab.com/group/.../repo/-/merge_requests/123
  // Capture everything before /-/merge_requests/, then split on last /
  const glUrlMatch = trimmed.match(/gitlab\.com\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (glUrlMatch) {
    const fullPath = glUrlMatch[1];
    const lastSlash = fullPath.lastIndexOf('/');
    if (lastSlash < 0) {
      throw new Error(`unrecognized GitLab URL: "${ref}" (namespace/repo path required)`);
    }
    return {
      owner: fullPath.slice(0, lastSlash),
      repo: fullPath.slice(lastSlash + 1),
      number: Number(glUrlMatch[2]),
      platform: 'gitlab',
    };
  }

  throw new Error(
    `unrecognized PR reference: "${ref}" (expected owner/repo#N, namespace/repo!N, or a GitHub/GitLab URL)`,
  );
}
