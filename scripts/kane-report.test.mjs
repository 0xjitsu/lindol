import { describe, expect, it } from 'vitest';
import { buildFeedback, classifyExit, completionEvent, parseNdjson } from './kane-report.mjs';

const passed = [
  '{"type":"stream_start","surface":"run","v":1}',
  '{"step":4,"status":"done","remark":"assert: PHIVOLCS link visible"}',
  '{"type":"run_end","status":"passed","summary":"heading Lindol + PHIVOLCS link visible; selected Manila, Metro Manila; every #list > li showed Magnitude M.. and a Distance .. km","credits_consumed":32,"test_url":"https://example.test/run","v":1}',
].join('\n');

describe('kane report', () => {
  it('classifies Kane exit codes', () => {
    expect(classifyExit(0)).toBe('passed');
    expect(classifyExit(1)).toBe('failed');
    expect(classifyExit(2)).toBe('did-not-start');
    expect(classifyExit(3)).toBe('timeout');
  });

  it('reads run_end status and summary from a passing stream', () => {
    const events = parseNdjson(passed + '\nnot json\n');
    const done = completionEvent(events);
    expect(done.status).toBe('passed');
    expect(done.summary).toContain('PHIVOLCS');
    const report = buildFeedback({ url: 'https://lindol-one.vercel.app', exitCode: 0, stdout: passed, stderr: '', command: 'npm run verify' });
    expect(report.kind).toBe('passed');
    expect(report.markdown).toContain('run_end');
    expect(report.markdown).toContain('Magnitude M');
    expect(report.markdown).toContain('No code change is required');
  });

  it('prefers testrun_done over an earlier step run_end', () => {
    const stdout = [
      '{"type":"run_end","status":"passed","summary":"step only"}',
      '{"type":"testrun_done","overall_status":"failed","summary":"one flow failed"}',
    ].join('\n');
    const done = completionEvent(parseNdjson(stdout));
    expect(done.type).toBe('testrun_done');
    expect(done.overall_status).toBe('failed');
  });

  it('tells the agent to fix the app and not the objective', () => {
    const stdout = '{"step":3,"status":"failed","remark":"assert: no 30-day button after an empty week"}\n{"type":"run_end","status":"failed","summary":"empty week had no next step"}';
    const report = buildFeedback({ url: 'https://preview.example', exitCode: 1, stdout, stderr: 'evidence: pack', command: 'npm run verify -- https://preview.example' });
    expect(report.kind).toBe('failed');
    expect(report.failed).toEqual(['assert: no 30-day button after an empty week']);
    expect(report.markdown).toContain('Do not weaken');
    expect(report.markdown).toContain('npm run verify -- https://preview.example');
  });

  it('names the credential env vars when Kane does not start', () => {
    const report = buildFeedback({ url: 'https://lindol-one.vercel.app', exitCode: 2, stdout: '', stderr: 'Not logged in', command: 'npm run verify' });
    expect(report.kind).toBe('did-not-start');
    expect(report.markdown).toContain('LT_USERNAME');
    expect(report.markdown).toContain('LT_ACCESS_KEY');
    expect(report.markdown).toContain('kane-cli login --oauth');
    expect(report.markdown).toContain('Do not treat this as a product bug.');
  });
});
