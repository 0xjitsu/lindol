# Kane caught an empty week near Manila

Credentialed run by the repo owner, 26 Nov 2026, 07:22 UTC, against the live site **before** the empty-state change. Kane CLI 0.10.9, OAuth on the owner's machine. This sandbox has no TestMu login, so the NDJSON below is the owner's report, not a file captured here. The raw stream was not pasted in full; do not invent the missing lines.

## Command

```bash
kane-cli run --headless --max-steps 25 --url https://lindol-one.vercel.app \
  "Open Lindol. Check heading + PHIVOLCS reference visible. Choose Manila. Verify a list of recent earthquakes near that city appears, each showing a magnitude and a distance."
```

## Result

Passed in 56.8s. Exit 0.

`run_end.summary`: "heading Lindol + PHIVOLCS link visible; selected Manila, Metro Manila; every #list > li showed Magnitude M.. and a Distance .. km".

The stream was NDJSON with `stream_start`, step events, and `run_end` (`status`, `summary`, `final_state`, `credits_consumed`, `test_url`). The owner reported the final listed item as **M4.7, 442 km SSE**. Before that list appeared, Kane took an extra step described as "select: Increasing earthquake search radius".

So the default search (200 km, last 7 days, M ≥ 2.5) did not show a list for Manila. Kane widened the radius until one did.

## USGS check the same morning

Queried from this workspace on 26 Nov 2026 against the public FDSN endpoint, centered on Manila (14.5995, 120.9842), M ≥ 2.5. Counts are what the service returned:

| Radius | Last 24 hours | Last 7 days | Last 30 days |
| --- | --- | --- | --- |
| 200 km | 0 | 0 | 2 |
| 300 km | 0 | 0 | 2 |
| 500 km | 0 | 1 | 4 |

The only quake inside 500 km in the last 7 days was **M4.7, 442 km SSE** (2 km NNW of Cabatuan, 24 Nov 2026, 23:29 UTC). That matches the item Kane reported.

Inside 200 km, the last 30 days had two closer quakes:

- M4.4, 73 km SSW (1 km SSE of Malaruhatan, 3 Nov 2026)
- M4.4, 167 km WNW (35 km WSW of Palauig, 17 Nov 2026)

Widening the radius answered "show me a list" with a quake 442 km away. The nearer events were still inside the default radius; they were older than seven days.

## Fix

The default stays 200 km and 7 days. That empty week is true, and 500 km is not "near my city".

When the current search is empty, Lindol asks USGS for the next longer period at the same radius before it tries a larger radius. If that finds a quake, the empty state names the closest one and offers a button, "Look at the last 30 days". The radius control is unchanged by that button. A larger radius is offered only when the longer period is empty too, one radius step at a time.

`npm run smoke` covers this with `tests/fixtures/usgs-older.json`: the 7-day response is empty, the 30-day response has one M4.4 inside 200 km, and clicking the button lists it without changing the radius.

## Verified after the fix

The same two committed flows passed against the PR preview after this change. Owner's machine, saved `kane-cli login`, Kane CLI 0.10.9, 2026-11-26 07:43Z. `npm run verify` exited 0. The suite completion event is `testrun_done` with `overall_status` `passed` and execution id `e01ea27f-91d7-45f9-9b89-df81f8229e7e` (`ts` `2026-11-26T07:43:27.130Z`). The feedback file says the flows passed and no code change is required. The evidence pack stayed on that machine.

The preview URL's `_vercel_share` value is redacted in this repo. Stdout, with that value removed:

```text
> lindol@0.0.0 verify
> node scripts/kane-verify.mjs https://lindol-git-cursor-kane-cli-verify-loop-4a08-xjitsu.vercel.app/?_vercel_share=<redacted>
preflight <url> → 200
kane-cli testrun run 2 flows --override-start-url <url> (saved kane-cli login)
passed
feedback: docs/kane/agent-feedback.md
EXIT=0
```
