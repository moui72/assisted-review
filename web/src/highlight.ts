// Syntax highlighting for diff lines. We register a curated set of languages
// (core build keeps the bundle lean) plus a compact Terraform/HCL grammar,
// since the Harness IaC repo is mostly .tf / .tftpl. Token colors are driven
// by CSS vars in index.css, so they're themeable later.

import hljs from 'highlight.js/lib/core';
import type { HLJSApi, Language } from 'highlight.js';

import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import ruby from 'highlight.js/lib/languages/ruby';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';

// Minimal Terraform / HCL grammar — enough for readable coloring.
function terraform(hljs: HLJSApi): Language {
  const INTERP = { className: 'template-variable', begin: /\$\{/, end: /\}/ };
  const STRING = {
    className: 'string',
    begin: '"',
    end: '"',
    contains: [hljs.BACKSLASH_ESCAPE, INTERP],
  };
  return {
    name: 'Terraform',
    aliases: ['tf', 'hcl'],
    keywords: {
      keyword:
        'resource variable module data output provider locals terraform dynamic',
      built_in: 'for_each count depends_on lifecycle source',
      literal: 'true false null',
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      STRING,
      { className: 'number', begin: /\b\d+(\.\d+)?/, relevance: 0 },
      { className: 'attr', begin: /[A-Za-z_][\w-]*(?=\s*=[^=])/ },
      { className: 'title', begin: /[A-Za-z_][\w-]*(?=\s*\()/, relevance: 0 },
    ],
  };
}

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('terraform', terraform);

const EXT_LANG: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  tftpl: 'yaml', // Harness pipeline templates are YAML
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  go: 'go',
  rb: 'ruby',
  css: 'css',
  scss: 'css',
  html: 'xml',
  xml: 'xml',
  vue: 'xml',
  svg: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  toml: 'ini',
  ini: 'ini',
  tf: 'terraform',
  hcl: 'terraform',
};

/** Resolve a highlight language id from a file path, or null if unsupported. */
export function langFor(file: string): string | null {
  const base = (file.split('/').pop() ?? file).toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  const ext = base.includes('.') ? base.split('.').pop()! : '';
  return EXT_LANG[ext] ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
  );
}

/** Highlight one line; returns sanitized HTML (escaped plaintext if no lang). */
export function highlightLine(code: string, lang: string | null): string {
  if (!code) return '';
  if (!lang) return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}
