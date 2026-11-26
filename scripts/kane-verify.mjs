#!/usr/bin/env node
// Run the committed Kane flows against a Lindol URL and write agent feedback.
// Exit 0 pass, 1 fail, 2 did not start, 3 timeout. Never prints credentials.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildFeedback } from './kane-report.mjs';

const FLOWS = [
  'kane/flows/manila_quiet_week_test.md',
  'kane/flows/city_and_language_test.md',
];
const FEEDBACK = 'docs/kane/agent-feedback.md';

function argUrl(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--url') return argv[i + 1] ?? '';
    if (argv[i].startsWith('--url=')) return argv[i].slice('--url='.length);
    if (!argv[i].startsWith('-')) return argv[i];
  }
  return '';
}

function kaneBin() {
  if (process.env.KANE_CLI) return process.env.KANE_CLI;
  const found = spawnSync('bash', ['-lc', 'command -v kane-cli'], { encoding: 'utf8' });
  return found.status === 0 ? found.stdout.trim() : '';
}

function write(report, extra) {
  mkdirSync(dirname(FEEDBACK), { recursive: true });
  const body = extra ? `${extra.trim()}\n\n${report.markdown}` : report.markdown;
  writeFileSync(FEEDBACK, body.endsWith('\n') ? body : `${body}\n`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = resolve('docs/kane/runs', stamp);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(resolve(runDir, 'feedback.md'), body);
}

const url = (argUrl(process.argv) || process.env.LINDOL_URL || 'https://lindol-one.vercel.app').replace(/\/$/, '');
const display = `npm run verify -- ${url}`;

function finish(exitCode, stdout, stderr, note) {
  const report = buildFeedback({ url, exitCode, stdout, stderr, command: display });
  write(report, note);
  const line = report.summary ? `${report.kind}: ${report.summary}` : report.kind;
  console.log(line);
  console.log(`feedback: ${FEEDBACK}`);
  process.exit(exitCode);
}

if (!/^https?:\/\//.test(url)) finish(2, '', `URL must be http(s): ${url}`, '');

let preflight = '';
try {
  const res = await fetch(url, { redirect: 'follow' });
  preflight = `preflight ${url} → ${res.status}`;
  console.log(preflight);
  if (!res.ok) finish(1, '', preflight, 'The URL did not return 200. If this is a Vercel preview that is still building, wait and rerun. Do not change the app only because the preview is not up yet.');
} catch (err) {
  finish(1, '', String(err), 'The URL could not be fetched. If this is a Vercel preview that is still building, wait and rerun.');
}

const bin = kaneBin();
if (!bin) {
  finish(2, '', 'kane-cli not on PATH', 'Install Kane CLI with `npm install -g @testmuai/kane-cli`, then sign in.');
}

const username = process.env.LT_USERNAME ?? '';
const accessKey = process.env.LT_ACCESS_KEY ?? '';
const authArgs = username && accessKey ? ['--username', username, '--access-key', accessKey] : [];
if (!authArgs.length) {
  const who = spawnSync(bin, ['whoami'], { encoding: 'utf8' });
  if (who.status !== 0) {
    finish(2, who.stdout, who.stderr, 'No LT_USERNAME/LT_ACCESS_KEY in the environment, and `kane-cli whoami` says this machine is not signed in.');
  }
}

const args = [
  'testrun', 'run', ...FLOWS,
  '--headless', '--agent', '--stream-members',
  '--override-start-url', url,
  ...authArgs,
];
console.log(`kane-cli testrun run ${FLOWS.length} flows --override-start-url ${url}${authArgs.length ? ' (basic auth from LT_USERNAME and LT_ACCESS_KEY)' : ' (saved kane-cli login)'}`);
const run = spawnSync(bin, args, { encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });
if (run.error && run.error.code === 'ETIMEDOUT') finish(3, run.stdout ?? '', run.stderr ?? '', 'The local timeout of 15 minutes fired before Kane exited.');
finish(run.status ?? 2, run.stdout ?? '', run.stderr ?? '', preflight);
