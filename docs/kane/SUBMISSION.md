# KaneCLI hackathon notes

Copy for the submission form. Both flows passed on the PR preview after the quiet-week fix (2026-11-26 07:43Z, exit 0).

## About your app

Lindol answers "May lindol ba malapit sa akin?" for any Philippine city: recent USGS earthquakes with magnitude, depth, distance, direction, and time in Philippine Time, plus a Duck, Cover and Hold card and a standing link to PHIVOLCS. It is a free public page, not a warning system and not an official source. A Cursor cloud agent added a Kane CLI loop on top of the existing app: plain-English flows in `kane/flows/`, `npm run verify` against the Vercel preview, and a stop hook that feeds Kane's pass or fail back to the agent. Kane's first run against the live site passed, and it had to widen the search radius because the default week near Manila was empty; the quake it found was M4.7 at 442 km. The nearer quakes that week-window missed were 73 km and 167 km away, inside the last 30 days, so the empty state now offers that longer window instead of sending people 442 km out.

## Demo video (about 3–5 minutes)

1. Open the live site. Show the PHIVOLCS banner, Manila, and the line that this is not an official source. (20 seconds)
2. Cut to the PR preview. With Manila at 200 km and the last 7 days, show the empty week, the sentence naming the closest quake in the last 30 days, and the button. Click it. Show the list, still at 200 km, with magnitude and distance. (50 seconds)
3. Terminal on a machine that is already `kane-cli login --oauth`. Run `npm run verify -- <preview-url>`. Show the browser step and the final pass line, including the summary. (70 seconds)
4. Open `docs/kane/caught-empty-radius.md`. Read the 07:22 UTC run: Kane passed only after increasing the radius, and reported M4.7 at 442 km SSE. Point at the USGS table: two closer quakes were inside 200 km, just older than 7 days. (40 seconds)
5. Show `.cursor/hooks.json` and `docs/kane/agent-feedback.md`. Say that a failed `run_end` becomes the agent's next instruction, and that the objective is not rewritten to force a pass. (30 seconds)
6. On the preview, type Davao City, click Refresh without using the suggestion list, and show the results name Davao City. Toggle Tagalog, then English. Scroll the safety card and the footer badge. (40 seconds)

Record the Kane window and the terminal in the same take if the login is on that machine. The sandbox that opened the PR cannot run Kane; the credentialed machine can.
