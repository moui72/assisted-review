#!/usr/bin/env node
// Generates docs/release-notes.md from GitHub Releases.
// Runs in CI before `mkdocs build`; needs GITHUB_TOKEN (or GH_TOKEN) for
// higher rate limits, but works unauthenticated too.
import { writeFile } from 'node:fs/promises';

const REPO = 'moui72/assisted-review';
const OUT = new URL('../docs/release-notes.md', import.meta.url);

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const headers = {
  accept: 'application/vnd.github+json',
  'user-agent': 'assisted-review-docs',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
};

const releases = [];
for (let page = 1; page <= 10; page++) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,
    { headers },
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const batch = await res.json();
  releases.push(...batch);
  if (batch.length < 100) break;
}

// Release bodies are markdown; demote any headings so they nest under ours.
const demote = (body) =>
  (body ?? '').replace(/^(#{1,4})(?=\s)/gm, (m) => '#'.repeat(Math.min(m.length + 2, 6)));

const sections = releases
  .filter((r) => !r.draft)
  .map((r) => {
    const date = new Date(r.published_at ?? r.created_at)
      .toISOString()
      .slice(0, 10);
    const pre = r.prerelease ? ' *(pre-release)*' : '';
    return `## [${r.name || r.tag_name}](${r.html_url})${pre}\n\n*${date}*\n\n${demote(r.body).trim()}\n`;
  });

const content = `---
hide:
  - navigation
---

# Release notes

<!-- This page is generated from GitHub Releases by scripts/generate-release-notes.mjs — do not edit by hand. -->

${sections.length ? sections.join('\n') : '_No releases yet._'}
`;

await writeFile(OUT, content);
console.error(`Wrote ${sections.length} releases to docs/release-notes.md`);
