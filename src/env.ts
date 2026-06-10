// Load a .env file into process.env before any other module reads it. Import
// this FIRST in the CLI entrypoint. dotenv does not override variables already
// present in the environment, so explicit `FOO=bar pnpm cli …` still wins, and
// a missing .env is a no-op (not an error). Override the path with
// DOTENV_CONFIG_PATH. `quiet` suppresses dotenv's startup tip.

import { config } from 'dotenv';

config({ path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true });
