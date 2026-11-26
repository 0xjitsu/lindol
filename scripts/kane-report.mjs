/** Turn a Kane CLI NDJSON stream into feedback a coding agent can act on. */

export function parseNdjson(text) {
  const events = [];
  for (const line of String(text ?? '').split(/\n/)) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    try { events.push(JSON.parse(s)); } catch { /* progress noise is not an event */ }
  }
  return events;
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

export function failedRemarks(events) {
  const remarks = [];
  for (const event of events) {
    walk(event, (node) => {
      if (node.status === 'failed' && typeof node.remark === 'string' && node.remark) remarks.push(node.remark);
    });
  }
  return remarks;
}

/** Prefer the suite's completion event. A run_end inside a suite only ends one step. */
export function completionEvent(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'testrun_done' || events[i].type === 'test_md_done') return events[i];
  }
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'run_end') return events[i];
  }
  return null;
}

export function classifyExit(exitCode) {
  if (exitCode === 0) return 'passed';
  if (exitCode === 1) return 'failed';
  if (exitCode === 2) return 'did-not-start';
  if (exitCode === 3) return 'timeout';
  return 'error';
}

export function buildFeedback({ url, exitCode, stdout, stderr, command }) {
  const events = parseNdjson(stdout);
  const done = completionEvent(events);
  const failed = failedRemarks(events);
  const kind = classifyExit(exitCode);
  const summary = typeof done?.summary === 'string' ? done.summary : '';
  const lines = [
    '# Kane verification feedback',
    '',
    `URL: ${url}`,
    `Exit code: ${exitCode ?? 'none'}`,
    `Result: ${kind}`,
  ];
  if (summary) lines.push(`Summary: ${summary}`);
  if (typeof done?.status === 'string') lines.push(`Status field: ${done.status}`);
  if (typeof done?.overall_status === 'string') lines.push(`Overall status: ${done.overall_status}`);
  if (failed.length) {
    lines.push('', '## Failed steps');
    for (const remark of failed) lines.push(`- ${remark}`);
  }
  lines.push('', '## What to do');
  if (kind === 'passed') {
    lines.push('The flows passed. No code change is required.');
    if (typeof done?.test_url === 'string') lines.push(`Evidence: ${done.test_url}`);
  } else if (kind === 'failed') {
    lines.push('Kane ran in a real browser and a flow failed. Fix Lindol so the flow passes.');
    lines.push('Do not weaken, delete, or reword the objective just to force a pass.');
    lines.push('Read the failed step remarks and the completion event, change the app, then run the same verify command again.');
  } else if (kind === 'did-not-start') {
    lines.push('Kane did not start. Nothing was verified.');
    lines.push('On a machine with a browser, sign in with `kane-cli login --oauth`.');
    lines.push('Or set both `LT_USERNAME` and `LT_ACCESS_KEY` (TestMu AI → Account Settings → Password & Security). The verify script passes them as `--username` and `--access-key` and does not print them.');
    lines.push('Install with `npm install -g @testmuai/kane-cli` if `kane-cli` is not on PATH. Do not treat this as a product bug.');
  } else if (kind === 'timeout') {
    lines.push('The run timed out or was cancelled. Run it again before changing the app. If it times out twice, raise `timeout` in the flow frontmatter.');
  } else {
    lines.push('The verify command failed before Kane returned a pass or fail. See the stderr excerpt. Do not change the product until you know the URL and the CLI both started.');
  }
  lines.push('', '## Completion event', '```json', done ? JSON.stringify(done, null, 2) : 'null', '```');
  const err = String(stderr ?? '').trim();
  if (err) lines.push('', '## stderr (tail)', '```', err.split('\n').slice(-40).join('\n'), '```');
  lines.push('', `Re-run: ${command}`, '');
  return { kind, done, failed, summary, markdown: lines.join('\n') };
}
