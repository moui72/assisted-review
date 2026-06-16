import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = join(tmpdir(), `assisted-review-state-${process.pid}-${Date.now()}`);
process.env.ASSISTED_REVIEW_STATE_DIR = dir;
