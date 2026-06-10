// Runs before any test module is imported. state.ts reads
// ASSISTED_REVIEW_STATE_DIR at module-load time, so it must be set here. Each Jest
// worker gets its own unique temp dir; tests clean up their own files.
/* eslint-disable @typescript-eslint/no-require-imports */
const os = require('node:os');
const path = require('node:path');

const dir = path.join(
  os.tmpdir(),
  `assisted-review-state-${process.pid}-${Date.now()}`,
);
process.env.ASSISTED_REVIEW_STATE_DIR = dir;
