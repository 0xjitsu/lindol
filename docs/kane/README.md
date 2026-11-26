# Verified with Kane CLI

Lindol's browser flows live in [`kane/flows/`](../../kane/flows) as plain-English Kane CLI tests (`*_test.md`). `npm run verify` runs them against a real URL and writes the pass/fail back to [`agent-feedback.md`](agent-feedback.md) for the coding agent.

## Sign in

Either of these works. Do not commit the values.

1. On a machine with a browser: `kane-cli login --oauth`. Later runs on that machine reuse the saved profile (`kane-cli whoami`).
2. In CI or a shell without a browser, set both:
   - `LT_USERNAME`
   - `LT_ACCESS_KEY`

   Find them in the TestMu AI dashboard under Account Settings → Password & Security. `npm run verify` passes them as `--username` and `--access-key` only when both are set, and it never prints them.

Kane CLI 0.10.9 is the version this loop was written against: `npm install -g @testmuai/kane-cli`.

## Run

```bash
npm run verify -- https://lindol-one.vercel.app
LINDOL_URL=https://<preview>.vercel.app npm run verify
```

The script checks the URL returns HTTP 200, then runs:

```bash
kane-cli testrun run kane/flows/manila_quiet_week_test.md kane/flows/city_and_language_test.md \
  --headless --agent --stream-members \
  --override-start-url "$URL"
```

`--override-start-url` points every flow at the preview without editing the committed `url:` (production). Stdout is NDJSON. The script reads `testrun_done` when the suite finishes, otherwise `run_end`, and uses the process exit code:

| Exit | Meaning |
| --- | --- |
| 0 | Passed |
| 1 | Kane ran and a flow failed, or the URL was not HTTP 200 |
| 2 | Did not start (not signed in, CLI missing) |
| 3 | Timed out |

On exit 1 the feedback file tells the agent what failed and to fix the app, not the wording of the flow. The Cursor `stop` hook (`.cursor/hooks.json`) and the Claude Code `Stop` hook (`.claude/settings.json`) submit that file as the next turn. They stay quiet when Kane did not start, unless `LINDOL_KANE_HOOK=1`. Set `LINDOL_KANE_HOOK=0` to skip the hook. A full suite is two browser runs; budget credits before looping.

`npm run smoke` is unchanged: mocked USGS, mobile and desktop, no Kane credits.

`docs/kane/dry-run.ndjson` is a `kane-cli testrun run --dry-run --agent` from Kane CLI 0.10.9 on a machine that is not signed in. The plan is `valid: true` for both flows. It does not open a browser and does not spend credits. `docs/kane/agent-feedback.md` in this commit is that same machine's `npm run verify` result: exit 2, did not start. The credentialed pass is [caught-empty-radius.md](caught-empty-radius.md). Replace `agent-feedback.md` after the preview run.

## Flows

- `manila_quiet_week_test.md` — heading, PHIVOLCS banner, Manila. A quiet 7-day search must offer the last 30 days and name the closest quake in that window, instead of leaving the agent to widen the radius.
- `city_and_language_test.md` — type Davao City, click Refresh without using the suggestion list, and see Davao in the results. Then Tagalog and back to English.

## What Kane already showed

The first credentialed run, and the USGS check that explains it, are in [caught-empty-radius.md](caught-empty-radius.md). Raw NDJSON from later preview runs belongs in this folder. `docs/kane/runs/` is local output and is gitignored.
