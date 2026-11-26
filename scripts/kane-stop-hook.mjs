#!/usr/bin/env node
// Cursor stop hook and Claude Code Stop hook.
// On a Kane failure, send the feedback file back as the next turn.
// A missing login does not loop unless LINDOL_KANE_HOOK=1.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function respond(payload) {
  process.stdout.write(JSON.stringify(payload));
}

let input;
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { input = {}; }

if (process.env.LINDOL_KANE_HOOK === '0') {
  respond({});
  process.exit(0);
}
if (input.status && input.status !== 'completed') {
  respond({});
  process.exit(0);
}
if (typeof input.loop_count === 'number' && input.loop_count >= 3) {
  respond({});
  process.exit(0);
}

const forced = process.env.LINDOL_KANE_HOOK === '1';
const unstaged = spawnSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' });
const staged = spawnSync('git', ['diff', '--name-only', '--cached'], { encoding: 'utf8' });
const names = `${unstaged.stdout || ''}\n${staged.stdout || ''}`;
const relevant = /^(src\/|index\.html|kane\/|scripts\/kane-)/m.test(names);
if (!forced && !relevant) {
  respond({});
  process.exit(0);
}

const verify = spawnSync('node', ['scripts/kane-verify.mjs'], {
  encoding: 'utf8',
  timeout: 16 * 60 * 1000,
  env: process.env,
});
const code = verify.status ?? 2;
if (code === 0 || (code === 2 && !forced)) {
  respond({});
  process.exit(0);
}

const feedback = existsSync('docs/kane/agent-feedback.md')
  ? readFileSync('docs/kane/agent-feedback.md', 'utf8').slice(0, 8000)
  : (verify.stderr || 'Kane verify failed').slice(0, 4000);
const message = `Kane CLI did not pass. Read the feedback below, fix Lindol, and run \`npm run verify\` again. Do not weaken the flow to force a pass.\n\n${feedback}`;

// Cursor stop uses followup_message. Claude Code Stop uses decision block.
if (input.hook_event_name === 'stop' || input.status != null || input.loop_count != null) {
  respond({ followup_message: message });
} else {
  respond({ decision: 'block', reason: message });
}
