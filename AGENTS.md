# Lindol

Public page for recent earthquakes near a Philippine city. Not a warning system. USGS data, PHIVOLCS link, English and Tagalog.

<!-- kane-cli:start -->
## End-to-end testing

Use Kane CLI (`kane-cli`) to verify the deployed site in a real browser. `npm run smoke` stays the fast mocked check. Do not remove it, and do not point Kane at the mocked smoke server.

- After a UI change, run `npm run verify -- <preview-url>`. That runs `kane/flows/*_test.md` with `--agent --headless` and `--override-start-url`.
- Kane's pass/fail is written to `docs/kane/agent-feedback.md`. Exit 0 means the flows passed. Exit 1 means Kane ran and a flow failed: fix the app and run the same command again. Do not weaken the flow to force a pass.
- Exit 2 means Kane did not start. Sign in with `kane-cli login --oauth`, or set both `LT_USERNAME` and `LT_ACCESS_KEY`. Those are the only credential variables. Never commit them.
- The Cursor `stop` hook and the Claude Code `Stop` hook run this loop when `src/`, `index.html`, or `kane/` is dirty. Set `LINDOL_KANE_HOOK=0` to skip the hook. Set `LINDOL_KANE_HOOK=1` to run it even on a clean tree.
- Report the verdict, the summary, and any evidence link from the run.

Setup: `npm install -g @testmuai/kane-cli` (this repo was written against 0.10.9).
<!-- kane-cli:end -->
