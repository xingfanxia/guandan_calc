# Technology Stack

**Analysis Date:** 2026-05-03

## Languages

**Primary:**
- JavaScript (ES2020+ / ES Modules) — entire frontend (`src/`) and serverless backend (`api/`). No TypeScript.
- HTML5 — multi-page entry shells: `index.html`, `players.html`, `player-profile.html`, `rooms.html`
- CSS — single hand-written stylesheet `src/style.css`. Per-page styles inline in each HTML head as `<style>` blocks (no CSS preprocessor, no Tailwind, no CSS-in-JS).

**Secondary:**
- Chinese (zh-CN) — primary content language. UTF-8 enforced everywhere; copy lives directly in source (no i18n framework).

## Runtime

**Browser target:**
- Modern evergreen browsers with native ES Module + dynamic import support. No Babel/transpilation step in `vite.config.js` — Vite's defaults apply (esbuild, ES2020 baseline).
- iOS Safari + Android Chrome are first-class targets (see PWA + touch-handler modules in `src/player/touchHandler.js`).

**Backend runtime (serverless):**
- Vercel Edge Functions (V8 isolate, Web-standard `Request`/`Response`, NOT Node). Every file in `api/**/*.js` exports `config = { runtime: 'edge' }`:
  - `api/rooms/create.js:114-116`
  - `api/rooms/[code].js:179-181`
  - `api/rooms/list.js:138-140`
  - `api/rooms/vote/[code].js:138-140`
  - `api/rooms/favorite/[code].js:142-144`
  - `api/rooms/reset-vote/[code].js:94-96`
  - `api/players/create.js:130-132`
  - `api/players/[handle].js:945-947`
  - `api/players/list.js:109-111`
  - `api/players/touch.js:72-74`
  - `api/players/delete.js:85-87`
  - `api/players/reset-stats.js:85-87`
  - `api/players/migrate-modes.js:186-189` (with `maxDuration: 60`)
  - `api/players/migrate-single.js:125-127`
  - `api/players/backfill-duration.js:118-121` (with `maxDuration: 30`)
- Edge runtime implications: `process.env` is the only env access available at top-level; no Node `fs`/`path`/`crypto` (uses Web Crypto via `crypto.getRandomValues` and `crypto.subtle.digest`).

**Node version:**
- No `engines` field in `package.json`, no `.nvmrc`, no `.node-version`. Vercel build agent default Node is used at build time. Runtime is Edge isolate, not Node, so dev-machine Node is only relevant for `vite` build/dev server.

**Package Manager:**
- npm (lockfile present: `package-lock.json`). No `yarn.lock`, no `pnpm-lock.yaml`.

## Frameworks

**Frontend framework:**
- **None.** Vanilla ES6 modules orchestrated by hand. No React, Vue, Svelte, Lit, Angular, or Preact. The architecture (per `CLAUDE.md`) is 38 hand-written modules under `src/` plus a legacy monolith reference at `src/app.js`.
- DOM access via small custom helpers in `src/core/utils.js` (`$`, `on`, `now`).
- Pub/sub via custom event bus in `src/core/events.js` (`on`, `emit`, `off`, `once`).

**Backend framework:**
- **None.** Each Edge Function is a single `export default async function handler(request)` returning a `new Response(...)`. No Express/Hono/Next API routes wrapper.

**Testing:**
- **No test framework configured.** No `jest.config.*`, no `vitest.config.*`, no Playwright/Cypress configs, no `*.test.*` or `*.spec.*` files in `src/`. Manual testing via `npm run dev` and per-Vercel-deploy verification.

**Build/Dev:**
- Vite `5.4.19` (declared `^5.0.0`, resolved per `package-lock.json`) — only build/dev tool. Used for:
  - Multi-entry SPA build: 4 HTML inputs declared in `vite.config.js:9-15` (main, players, rooms, profile)
  - Dev server with HMR on port 3000 (`vite.config.js:18-21`) — note: project README mentions 5173, actual config is 3000
  - Production build outputs to `dist/`, deployed by Vercel (`vercel.json:2-4`)

## Key Dependencies

**Runtime (`dependencies`):**
- `@vercel/kv` `3.0.0` (declared `^3.0.0`) — Upstash Redis client used in EVERY API route (`import { kv } from '@vercel/kv'`). Provides `kv.get`, `kv.set`, `kv.setex`, `kv.del`, `kv.keys`, `kv.scan`. No other database client.
- `chart.js` `4.5.1` (declared `^4.5.1`) — only used on the player profile page for: line chart of recent rankings, horizontal bar charts of partner/opponent win rates. Imported with tree-shake-friendly `Chart, registerables` in `player-profile.html:99` and registered manually via `Chart.register(...registerables)`. Not used anywhere else in the app.

**Dev (`devDependencies`):**
- `vite` `5.4.19` (declared `^5.0.0`) — see Build/Dev above.

**That's the entire dependency graph.** No frontend framework, no UI library, no state-management lib, no fetch wrapper, no validation lib (Zod/Yup absent), no date library (native `Date` + `toISOString` everywhere), no auth SDK, no analytics SDK, no error-tracking SDK.

## Configuration

**Environment variables:**
- `KV_REST_API_URL` — Vercel KV REST endpoint (auto-injected by Vercel KV integration; see `.env.example:5`)
- `KV_REST_API_TOKEN` — Vercel KV REST token (auto-injected; see `.env.example:6`)
- `KV_URL` — optional direct Redis connection string (`.env.example:9`)
- `ADMIN_TOKEN` — required env var for all admin endpoints (delete/reset-stats/migrate-modes + PROFILE_UPDATE/ROTATE_TOKEN paths). Validated in `api/players/_utils.js:196-211` with constant-time compare; if unset, ALL admin endpoints fail-closed (return 403).

**Env files (existence noted, contents not read):**
- `.env.example` (committed) — template documenting required vars
- `.env.local` (NOT committed; in working tree) — local dev secrets

**Build config:**
- `package.json` — declares dependencies, type `module`, scripts `dev`/`build`/`preview`
- `vite.config.js` — Vite multi-entry config, `outDir: 'dist'`, `publicDir: 'public'`
- `vercel.json` — minimal: `buildCommand: npm run build`, `outputDirectory: dist`, `framework: null` (Vercel auto-detects API routes from `api/` directory)
- `package-lock.json` — npm lockfile (committed)

**No tsconfig** (project is plain JS), **no .eslintrc / .prettierrc / biome config** (no auto-formatting/linting enforcement in repo).

## Frontend Asset Pipeline

**CSS:**
- Single global stylesheet `src/style.css`, loaded by every HTML page via `<link rel="stylesheet" href="/src/style.css">`.
- Page-specific styles inline in `<style>` blocks within each HTML `<head>` (e.g., `index.html:21-67` for nav tabs, `players.html:13-88`, etc.).

**Fonts:**
- Native system stack only — no `@font-face`, no Google Fonts CDN, no font preconnect hints in any HTML head.

**Icons:**
- Emoji-as-icons throughout (Chinese-app convention). 77+ animal emojis used as default avatars in `src/player/playerManager.js` (referenced in `playerCreateModal.js:9`).
- PNG favicons + PWA icons under `public/icons/` (`icon-192.png`, `icon-512.png`) and `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/favicon.ico`.

**Images:**
- Profile photos uploaded by users are processed entirely in-browser: `FileReader` → `<canvas>` resize to 400x400 → `canvas.toDataURL('image/jpeg', 0.8)` → base64 string stored in player KV record. See `src/player/playerCreateModal.js:306-318`. Capped at ~150KB base64 in `api/players/_utils.js:94`.
- PNG export of game history uses an offscreen `<canvas id="longCnv" width="1200" height="1600">` declared in `index.html:501`.

**PWA:**
- Web app manifest at `public/manifest.json` (standalone display, portrait-primary, zh-CN, 192/512 icons with `any` + `maskable` purposes).
- Service worker `public/sw.js` — version-tagged caches `guandan-calc-v10.1` + `guandan-runtime-v10.1`. Strategy: API requests → network only; static assets → network-first with cache fallback; offline fallback → `index.html`. Service worker is NOT auto-registered in `src/main.js` based on top-of-file imports — registration would be wired separately (verify in main.js full read if needed).

## Platform Requirements

**Development:**
- Node + npm (any recent LTS — Vite 5 supports Node 18+).
- Local Vercel KV credentials in `.env.local` for backend testing, OR run frontend-only via `npm run dev` (browser will see API 5xx without KV).

**Production:**
- Vercel platform (Edge Functions runtime + Vercel KV / Upstash Redis integration).
- All API routes execute on Vercel's global edge network (low-latency reads from any region).
- `vercel.json` declares no rewrites/redirects — Vercel's filesystem routing maps `/api/**` to Edge Functions and serves `dist/` for everything else.

## Notable Anomalies

1. **Two doc-config drifts noted (informational, not action items):**
   - `CLAUDE.md` says dev port is 5173; `vite.config.js:19` declares port 3000.
   - `CLAUDE.md` describes a v9.0 stack and 1947-line legacy `src/app.js`; current `package.json:3` is `"version": "8.0.0"`. Production HTML (`index.html:6`) self-identifies as `v10.0`.
2. **Zero test framework** — risk surface for the complex A-level rules engine and stats migration logic (multiple migration scripts in `api/players/migrate-*.js` perform irreversible KV mutations with no automated verification).
3. **No linter/formatter** — code style enforcement is by convention only. Affects long-term maintainability of 38 modules.
4. **`maxDuration` on edge functions:** `migrate-modes.js` (60s) and `backfill-duration.js` (30s) — these scan-all-players endpoints can run long; standard Edge Function default is 30s on Hobby tier.

---

*Stack analysis: 2026-05-03*
