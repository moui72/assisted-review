// Parse a unified diff into grouped hunks, via the `parse-diff` npm package
// (see infrastructure.md's Integration Components — this replaced a
// hand-rolled port of an earlier Python parser). Output shape:
// { id, file, hunk_header, old_range, new_range, context, diff, members }.

import parseDiffLib from 'parse-diff';
import type { Chunk, HunkMember, LineRange, RawHunk } from './types.js';

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function warn(msg: string): void {
  console.error(`parse-diff: warning: ${msg}`);
}

function stripCR(line: string): string {
  return line.replace(/\r$/, '');
}

export function parseDiff(text: string): RawHunk[] {
  const files = parseDiffLib(text);
  const hunks: RawHunk[] = [];
  let counter = 0;

  for (const file of files) {
    const filePath =
      file.to && file.to !== '/dev/null'
        ? file.to
        : file.from && file.from !== '/dev/null'
          ? file.from
          : null;
    if (filePath === null) {
      if (file.chunks.length > 0) {
        warn('hunk encountered with no known file path; skipping');
      }
      continue;
    }

    for (const chunk of file.chunks) {
      counter += 1;
      const headerLine = stripCR(chunk.content);
      const m = headerLine.match(HUNK_HEADER_RE);
      const context = m ? m[5].trim() : '';
      const oldRange: LineRange =
        chunk.oldLines === 0
          ? [chunk.oldStart, chunk.oldStart]
          : [chunk.oldStart, chunk.oldStart + chunk.oldLines - 1];
      const newRange: LineRange =
        chunk.newLines === 0
          ? [chunk.newStart, chunk.newStart]
          : [chunk.newStart, chunk.newStart + chunk.newLines - 1];
      const bodyLines = chunk.changes.map((c) => stripCR(c.content));

      hunks.push({
        id: `c${counter}`,
        file: filePath,
        hunk_header: headerLine,
        old_range: oldRange,
        new_range: newRange,
        context,
        diff: [headerLine, ...bodyLines].join('\n'),
      });
    }
  }

  return hunks;
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
