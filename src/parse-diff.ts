// Parse a unified diff into grouped hunks. Pure TS — same output shape as the
// original parse-diff.py: an array of groups, each with
// { id, file, hunk_header, old_range, new_range, context, diff, members }.

import type { Chunk, HunkMember, LineRange, RawHunk } from './types';

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function warn(msg: string): void {
  console.error(`parse-diff: warning: ${msg}`);
}

// Extract (old, new) paths from a `diff --git a/<old> b/<new>` line.
// Returns [null, null] for ambiguous cases (paths containing " b/"); the
// caller falls back to the --- / +++ markers.
function parseGitDiffPaths(line: string): [string | null, string | null] {
  const rest = line.slice('diff --git '.length);
  if (rest.startsWith('a/')) {
    const idx = rest.indexOf(' b/');
    if (idx !== -1) {
      const old = rest.slice(2, idx);
      const neu = rest.slice(idx + 3).replace(/\n$/, '');
      return [old, neu];
    }
  }
  return [null, null];
}

// Extract path from a `--- a/<path>` or `+++ b/<path>` marker line.
function extractPathFromMarker(line: string, prefix: string): string | null {
  let s = line.slice(prefix.length).replace(/\n$/, '');
  if (s === '/dev/null') return null;
  if (s.startsWith('a/') || s.startsWith('b/')) s = s.slice(2);
  const tabIdx = s.indexOf('\t');
  if (tabIdx !== -1) s = s.slice(0, tabIdx);
  return s;
}

export function parseDiff(text: string): RawHunk[] {
  // Match Python's str.splitlines() closely enough for diffs: split on \n and
  // drop a single trailing \r so CRLF diffs don't leave \r in the body.
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const chunks: RawHunk[] = [];
  let chunkCounter = 0;

  let curOldPath: string | null = null;
  let curNewPath: string | null = null;
  let isBinary = false;

  let inHunk = false;
  let hunkHeaderLine = '';
  let hunkBody: string[] = [];
  let hunkOldStart = 0;
  let hunkOldCount = 0;
  let hunkNewStart = 0;
  let hunkNewCount = 0;
  let hunkContext = '';

  function finalizeHunk(): void {
    if (!inHunk) return;
    let filePath: string;
    if (curNewPath !== null) filePath = curNewPath;
    else if (curOldPath !== null) filePath = curOldPath;
    else {
      warn('hunk encountered with no known file path; skipping');
      inHunk = false;
      hunkBody = [];
      return;
    }

    chunkCounter += 1;
    const oldRange: LineRange =
      hunkOldCount === 0
        ? [hunkOldStart, hunkOldStart]
        : [hunkOldStart, hunkOldStart + hunkOldCount - 1];
    const newRange: LineRange =
      hunkNewCount === 0
        ? [hunkNewStart, hunkNewStart]
        : [hunkNewStart, hunkNewStart + hunkNewCount - 1];

    const diffText = [hunkHeaderLine, ...hunkBody].join('\n');
    chunks.push({
      id: `c${chunkCounter}`,
      file: filePath,
      hunk_header: hunkHeaderLine,
      old_range: oldRange,
      new_range: newRange,
      context: hunkContext.trim(),
      diff: diffText,
    });
    inHunk = false;
    hunkBody = [];
  }

  const SKIP_PREFIXES = [
    'index ',
    'similarity ',
    'dissimilarity ',
    'rename ',
    'copy ',
    'new file mode',
    'deleted file mode',
    'old mode',
    'new mode',
    'GIT binary patch',
  ];

  let i = 0;
  const n = lines.length;
  while (i < n) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      finalizeHunk();
      [curOldPath, curNewPath] = parseGitDiffPaths(line);
      isBinary = false;
      i += 1;
      continue;
    }

    if (line.startsWith('Binary files ') && line.endsWith('differ')) {
      finalizeHunk();
      isBinary = true;
      i += 1;
      continue;
    }

    if (isBinary) {
      i += 1;
      continue;
    }

    if (line.startsWith('--- ')) {
      finalizeHunk();
      const p = extractPathFromMarker(line, '--- ');
      if (p !== null) curOldPath = p;
      i += 1;
      continue;
    }

    if (line.startsWith('+++ ')) {
      finalizeHunk();
      const p = extractPathFromMarker(line, '+++ ');
      if (p !== null) curNewPath = p;
      i += 1;
      continue;
    }

    if (SKIP_PREFIXES.some((p) => line.startsWith(p))) {
      i += 1;
      continue;
    }

    const m = line.match(HUNK_HEADER_RE);
    if (m) {
      finalizeHunk();
      hunkOldStart = Number(m[1]);
      hunkOldCount = m[2] !== undefined ? Number(m[2]) : 1;
      hunkNewStart = Number(m[3]);
      hunkNewCount = m[4] !== undefined ? Number(m[4]) : 1;
      hunkContext = m[5] || '';
      hunkHeaderLine = line;
      hunkBody = [];
      inHunk = true;
      i += 1;
      continue;
    }

    if (inHunk) {
      if (/^[+\- \\]/.test(line)) {
        hunkBody.push(line);
        i += 1;
        continue;
      }
      // Unexpected line inside a hunk — end it and reprocess this line.
      finalizeHunk();
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }
    warn(`skipping unrecognized line: ${JSON.stringify(line)}`);
    i += 1;
  }

  finalizeHunk();
  return chunks;
}

function singletonGroup(ch: RawHunk): Chunk {
  return {
    id: ch.id,
    file: ch.file,
    hunk_header: ch.hunk_header,
    old_range: [...ch.old_range],
    new_range: [...ch.new_range],
    context: ch.context ?? '',
    diff: ch.diff,
    members: [
      {
        hunk_header: ch.hunk_header,
        old_range: [...ch.old_range],
        new_range: [...ch.new_range],
      },
    ],
  };
}

// Merge adjacent hunks in the same file separated by <= `gap` unchanged
// new-file lines. gap <= 0 disables merging (every hunk is its own group).
export function groupChunks(chunks: RawHunk[], gap = 20): Chunk[] {
  if (chunks.length === 0) return [];
  const groups: Chunk[] = [singletonGroup(chunks[0])];
  if (gap <= 0) {
    for (const ch of chunks.slice(1)) groups.push(singletonGroup(ch));
    return groups;
  }
  for (const ch of chunks.slice(1)) {
    const cur = groups[groups.length - 1];
    const sameFile = ch.file === cur.file;
    const prevEnd = cur.new_range[1];
    const thisStart = ch.new_range[0];
    const newGap = Math.max(0, thisStart - prevEnd - 1);
    if (sameFile && newGap <= gap) {
      cur.diff = `${cur.diff}\n${ch.diff}`;
      cur.new_range[1] = ch.new_range[1];
      cur.old_range[1] = ch.old_range[1];
      const member: HunkMember = {
        hunk_header: ch.hunk_header,
        old_range: [...ch.old_range],
        new_range: [...ch.new_range],
      };
      cur.members.push(member);
    } else {
      groups.push(singletonGroup(ch));
    }
  }
  return groups;
}

// Convenience: raw diff text -> grouped chunks.
export function chunksFromDiff(diffText: string, gap = 20): Chunk[] {
  return groupChunks(parseDiff(diffText), gap);
}
