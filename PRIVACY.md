# Disabling trackers & analytics

This fork ships a single opt-out switch:

```bash
npm run no-tracking          # disable everything (idempotent)
npm run no-tracking:check    # report only; exits non-zero if tracking is on
npm run no-tracking:restore  # put upstream's behaviour back
npm run sync                 # git pull && npm run no-tracking
```

`npm run dev:backend`, `npm run dev:frontend`, `npm run build` and `start.bat`
all run `no-tracking` first, so **anything you actually start has tracking
disabled** whether or not you remember to run it by hand.

## What it turns off

**1. Google Fonts (`frontend/index.html`)**
Upstream loads the Inter webfont from `fonts.googleapis.com`, which hands every
visitor's IP address and User-Agent to Google on page load. The script deletes
the `<link>`. Type still renders correctly — `frontend/src/index.css` and
`frontend/tailwind.config.js` already declare `'Inter', system-ui, sans-serif`,
so it falls through to the system UI font.

**2. Claude CLI telemetry**
The backend spawns the `claude` CLI (`ProcessManager.ts`,
`StreamProcessor.ts`, `UnifiedStreamProcessor.ts`), and each spawn site passes
`{ ...process.env }` to the child. So opting out in the env files that the
backend loads through dotenv reaches every spawned process. The script writes a
managed block into `.env` and `.env.dev`:

| Variable | Effect |
| --- | --- |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | umbrella switch for all non-essential traffic |
| `DISABLE_TELEMETRY=1` | usage telemetry |
| `DISABLE_ERROR_REPORTING=1` | crash/error reporting |
| `DISABLE_BUG_COMMAND=1` | `/bug` report upload |
| `DISABLE_AUTOUPDATER=1` | background update checks |
| `DISABLE_NON_ESSENTIAL_MODEL_CALLS=1` | non-critical model calls |
| `CLAUDE_CODE_ENABLE_TELEMETRY=0` | OpenTelemetry export |

Your own keys in `.env` are left alone — only the block between the
`no-tracking (managed …)` markers is rewritten, and `restore` removes just that
block.

**3. A scanner for whatever upstream adds next**
Every run greps the tree for known tracker hosts (GA, GTM, Segment, Sentry,
PostHog, Mixpanel, Hotjar, Datadog, Plausible, Matomo, Statsig, …) and for
analytics packages in any `package.json`. `no-tracking:check` exits non-zero if
it finds something, so it drops straight into CI or a pre-push hook.

## Staying in sync with upstream

The design keeps the diff against `cablate/Claude-Code-Board` deliberately tiny
so merges stay boring:

- `.env` / `.env.dev` are gitignored — they never conflict.
- `frontend/index.html` differs by one deleted line.
- `package.json` differs by four added scripts and three prefixed ones.
- `scripts/no-tracking.sh` and this file are new — upstream can't conflict.

After pulling:

```bash
npm run sync
```

If `frontend/index.html` conflicts, just take upstream's side and re-run —
the script is idempotent and will re-strip whatever is in there.
