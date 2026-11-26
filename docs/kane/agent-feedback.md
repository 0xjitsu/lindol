No LT_USERNAME/LT_ACCESS_KEY in the environment, and `kane-cli whoami` says this machine is not signed in.

# Kane verification feedback

URL: https://lindol-one.vercel.app
Exit code: 2
Result: did-not-start

## What to do
Kane did not start. Nothing was verified.
On a machine with a browser, sign in with `kane-cli login --oauth`.
Or set both `LT_USERNAME` and `LT_ACCESS_KEY` (TestMu AI → Account Settings → Password & Security). The verify script passes them as `--username` and `--access-key` and does not print them.
Install with `npm install -g @testmuai/kane-cli` if `kane-cli` is not on PATH. Do not treat this as a product bug.

## Completion event
```json
null
```

## stderr (tail)
```
Skill update available: not installed → 0.1.4 — run `kane-cli install skill`
```

Re-run: npm run verify -- https://lindol-one.vercel.app
