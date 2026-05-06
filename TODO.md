# Guandan Calculator — Development TODO

**Last Updated**: 2026-05-06
**Current Phase**: v10 + Theme System (5 phases all shipped) + Visual Regression CI

---

## What Shipped Since This File Was Last Reconciled (2025-12-11)

This file fell behind by ~5 months. Major work shipped between then and now:

### Theme System (5 phases shipped)
- Phase 0+1+1.5 — Broadcast Editorial baseline (default), token-spec contract, live data wiring
- Phase 2 — Linear / Vercel Console (density-first, single Linear-purple accent)
- Phase 2.5 — Linear sidebar via `layout.mount/unmount` (move-not-clone of topnav)
- **Phase 2.6 (2026-05-06)** — Linear sidebar polish: section label, active-tab accent bar, user-card status dot
- **Phase 5 (2026-05-06)** — Tea-Table Console theme: deep warm graphite + vermillion accent + Noto Serif SC; 17 ink-brush honor portraits generated via gpt-image-2 (Azure). All five planned theme phases now shipped.
- Phase 3 — Trading Terminal (JetBrains Mono, near-black, ASCII bracket flair)
- Phase 3.5 — Sparkline renderer (manifest-gated, on for Trading)
- Phase 4 — Atelier Console (Fraunces serif, clay accent, vintage card stock); + 4 polish iterations
- Phase 4.5 — Mobile calcpreview column-layout fix
- VictoryModal class-based contract — every theme MUST style `.victory-modal*` (4 themes verified)

### Security & Audit (May 2026)
- 2026-05-02 audit — 10 findings closed across 3 commits (P0+P1+P2+P3)
- Per-user ownership tokens for `PROFILE_UPDATE` (CSPRNG, SHA-256 hash, sanitize on response)
- Stats-update 3-tier auth (admin / owner Bearer / room-host Bearer with membership check)
- Vote forgery prevention (server-authoritative endGameVotes)
- Vote fingerprint cap (1000 max)
- Modal a11y helper (`src/core/modal.js`)
- ADMIN_TOKEN env-var protection (constant-time, fail-closed)
- 6/8-mode rule simplification (no A-fail counter)
- XSS escape coverage extension across player-data renderers (~36 sites)
- CSV formula-injection guard (`csvEscape` prefixes `=+-@\t\r` cells per OWASP)
- Inline FOUC bootstrap (synchronous theme read in every entry HTML)

### Achievement Notifications (2026-05-06) ⭐ NEW
- Toast notification system — `src/ui/toast.js` (theme-agnostic via TOKEN_SPEC vars)
- `syncProfileStats` consumes server-returned `newAchievements` and surfaces toast per unlock
- XSS-safe by construction (createElement + textContent only)
- Per-player stagger (600ms) for multi-unlock display

### Visual Regression CI
- 65 baseline PNGs across 7 capture scripts
- Pixelmatch-based with deterministic fixtures (`freezeTime` + `setDeterministicPlayers`)
- Per-directory threshold overrides for known canvas-rendering noise
- GitHub Actions workflow on every PR

---

## 🐛 Known Issues (Minor, Triaged)

### Behaviorally Correct But Could Improve
- [ ] Local voting results don't sync to profiles (only room voting). Workaround: use room mode for voting
- [ ] Partner/rival only tracks profile players (session-only players skipped) — by design, no persistent identity
- [ ] Recent rankings not retrospective (forward-only) — by design, schema migration would be needed

### Quality / Tech Debt
- [ ] Add unit tests for honor-calculation algorithms (only VR coverage today)
- [ ] Performance audit on long histories (100+ rounds)
- [ ] A11y sweep — keyboard nav across pages, ARIA on more components

---

## 🎯 Active Workstreams

### High Priority
- (none — all five planned theme phases shipped 2026-05-06)

### Polish-on-demand
- **Phase 2.6.x — Linear sidebar polish iter 2** — open-ended visual; demo-linear-v2 has additional aspirational details (workspace section, multi-section nav) that weren't shipped in 2.6 to avoid fabricating IA. Consider only after the app actually grows more navigable surface area.
- **Tea-Table polish iter 2** — current Phase 5 is "minimal-but-real" parity with `demo-teatable-v3.png`. Specific surfaces that could push aggregate match higher: brush-rule dividers between sections (currently rule-soft borders), section-num + section-en pairs in headings (demo has `01 / SECTION` mono labels), pool-block pcard rotation per individual tile (demo has each tile slightly rotated).

### Medium Priority
- [ ] **Season system** — monthly/quarterly leaderboards, season achievements, historical data. Large effort
- [ ] **Mobile UX polish** — swipe nav, touch-optimized profile cards, larger emoji selector
- [ ] **Profile share button** — copy link, QR code for profile URL
- [ ] **Voting countdown timer** — show "5 min remaining" indicator during voting window

### Low Priority / Future
- [ ] OAuth profile claiming (works fine without it today via ownership tokens)
- [ ] Performance trends visualization
- [ ] Optimal team composition suggester
- [ ] Replay system

---

## 📋 Maintenance Hooks

- KV storage quota monitoring (256MB free tier)
- Test player cleanup (`test_*` handles) before any public launch
- Dependency update sweep
- Security patch monitoring

---

## 📚 Reference Docs

- [docs/architecture/CODEBASE_STRUCTURE.md](docs/architecture/CODEBASE_STRUCTURE.md) — file-by-file map
- [docs/architecture/PLAYER_PROFILE_ARCHITECTURE.md](docs/architecture/PLAYER_PROFILE_ARCHITECTURE.md) — player profile system
- [docs/architecture/KV_SCHEMA.md](docs/architecture/KV_SCHEMA.md) — database patterns
- [docs/SECURITY.md](docs/SECURITY.md) — auth model + threat surface
- [docs/design/THEME-ARCHITECTURE.md](docs/design/THEME-ARCHITECTURE.md) — 5-phase theme plan
- [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md) — feature completion tracker

---

## 🚀 Deployment

- Platform: Vercel Edge + KV (Upstash Redis)
- Auto-deploy: push to `main` → build → deploy
- Production: https://gd.ax0x.ai
- Build: `npm run build` → `dist/`
- Local dev: `npm run dev` (port 3000, proxies `/api/*` to production)
- Visual regression: `npm run test:visual` (65 baselines, pixelmatch)
- Theme switch smoke test: `node scripts/visual/test-theme-switch.mjs` (20 assertions)
