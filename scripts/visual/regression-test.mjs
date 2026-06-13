// Visual regression entry point: runs every capture script with output
// redirected to a snapshot dir, then pixel-diffs the snapshot against the
// committed baselines under docs/reports/.
//
// Usage:
//   node scripts/visual/regression-test.mjs
//
// Env:
//   BASELINE_DIR   default = docs/reports
//   SNAPSHOT_DIR   default = /tmp/visual-snapshot-<pid>
//   THRESHOLD      default = 100   (pixel count threshold; absorbs sub-pixel
//                                    AA jitter — Playwright shows 1-6 px noise
//                                    on emoji glyphs at desktop, and Canvas-
//                                    based PNG export shows 27-71 px noise on
//                                    1MP+ images from font subpixel rendering.
//                                    Real UI changes measure 100s-1000s+ px,
//                                    so 100 px is functionally zero for
//                                    regression. Bump per-image if needed.)
//   KEEP_SNAPSHOT  default = 0     (set 1 to leave snapshot dir on disk)
//   DIFF_OUT       default = 0     (set 1 to always write diff PNGs, even on pass)
//
// Capture scripts must honor `VISUAL_REPORT_BASE` env (so they write into
// SNAPSHOT_DIR instead of docs/reports/). Wrapper sets that automatically
// when spawning each capture process.
//
// Exit codes mirror diff-baselines.mjs:
//   0 — all comparable files within threshold
//   1 — at least one file exceeded threshold (diff)
//   2 — usage / setup error
//   3 — orphan files (a PNG in baseline missing from current or vice versa)

import { spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');

// Capture scripts to run, in order. Each writes to a hardcoded subdir under
// VISUAL_REPORT_BASE. Adding a capture = add the script here AND make it
// (1) honor VISUAL_REPORT_BASE, (2) honor GD_BASE_URL, and (3) import
// freezeTime + setDeterministicPlayers from _fixtures.mjs for determinism.
//
// Pixel baselines are a LOCAL gate (system-font stack → macOS/Linux renders
// are not pixel-comparable; CI runs captures as a structural smoke only —
// see .github/workflows/visual-regression.yml).
const CAPTURES = [
  'capture-redesign.mjs',     // all 4 pages × light/dark × mobile/desktop — redesign/
  'capture-png-exports.mjs',  // canvas PNG export under light + dark — png-export/
];

const BASELINE_DIR = path.resolve(ROOT, process.env.BASELINE_DIR || 'docs/reports');
const SNAPSHOT_DIR = path.resolve(process.env.SNAPSHOT_DIR || `/tmp/visual-snapshot-${process.pid}`);
const THRESHOLD = process.env.THRESHOLD || '100';
const KEEP_SNAPSHOT = process.env.KEEP_SNAPSHOT === '1' || process.env.KEEP_SNAPSHOT === 'true';
const DIFF_OUT = process.env.DIFF_OUT === '1' || process.env.DIFF_OUT === 'true';

if (BASELINE_DIR === SNAPSHOT_DIR) {
  console.error('BASELINE_DIR and SNAPSHOT_DIR resolve to the same path — refusing to overwrite baselines.');
  process.exit(2);
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: ROOT,
      env: { ...process.env, ...env },
    });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → exit ${code}`)));
    child.on('error', reject);
  });
}

async function main() {
  if (existsSync(SNAPSHOT_DIR)) {
    rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
  }
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  console.log(`baseline:   ${BASELINE_DIR}`);
  console.log(`snapshot:   ${SNAPSHOT_DIR}`);
  console.log(`captures:   ${CAPTURES.length}`);
  console.log('');

  // Run each capture with VISUAL_REPORT_BASE pointed at snapshot dir.
  for (const script of CAPTURES) {
    console.log(`▶ ${script}`);
    await run('node', [path.join('scripts/visual', script)], { VISUAL_REPORT_BASE: SNAPSHOT_DIR });
    console.log('');
  }

  // Pixel diff
  const diffArgs = [
    'scripts/visual/diff-baselines.mjs',
    BASELINE_DIR,
    SNAPSHOT_DIR,
    THRESHOLD,
  ];
  await run('node', diffArgs, DIFF_OUT ? { DIFF_OUT: '1' } : {});
}

let exitCode = 0;
try {
  await main();
} catch (err) {
  // diff-baselines.mjs exits 1 on diff, 3 on orphans — surface that.
  if (err.message.includes('exit 1')) exitCode = 1;
  else if (err.message.includes('exit 3')) exitCode = 3;
  else {
    console.error(`regression-test failed: ${err.message}`);
    exitCode = 2;
  }
}

if (!KEEP_SNAPSHOT && existsSync(SNAPSHOT_DIR)) {
  rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
}

process.exit(exitCode);
