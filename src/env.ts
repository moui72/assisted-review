// Loads a .env file (KEY=VALUE lines) into process.env before any other module
// reads it. Import this FIRST in the CLI entrypoint. Variables already present
// in the environment take precedence, so explicit `FOO=bar pnpm cli …` wins.

import { existsSync, readFileSync } from 'node:fs';

const path = process.env.DOTENV_CONFIG_PATH || '.env';
if (existsSync(path)) {
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    process.env[key] = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
}
