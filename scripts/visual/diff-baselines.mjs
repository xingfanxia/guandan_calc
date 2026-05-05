// Visual regression: pixel-diff every PNG under <baselineDir> against the
// matching PNG under <currentDir>. Reports per-file diffs and fails when
// total diff pixels exceed the threshold (default 0 — exact match).
//
// Usage:
//   node scripts/visual/diff-baselines.mjs <baselineDir> <currentDir> [threshold]
//
// Defaults to comparing `docs/reports/` against itself, which is useful only
// when one of the two has been backed up first. Real callers pass two
// distinct dirs.
//
// Threshold is in pixels (integer). Use 0 for strict diff. The pixelmatch
// per-pixel tolerance is fixed at 0.1 (matches the prototype script).
//
// Exit codes:
//   0 — all comparable files within threshold
//   1 — at least one file exceeded threshold (diff)
//   2 — usage error / setup error
//   3 — orphan files (a PNG in baseline missing from current or vice versa)
//
// Diff PNGs (red where pixels differ) are written to <currentDir>/_diff/
// when DIFF_OUT=1 is set or when any file fails — useful for PR artifacts.

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const PIXELMATCH_THRESHOLD = 0.1;  // per-pixel color tolerance (0..1)

// Per-directory threshold overrides for known-noisy baselines. Keyed by
// path prefix; the longest matching prefix wins. Canvas-rendered PNG exports
// (`png-export-themes/`) show 100-160 px of font subpixel-rendering noise on
// 1.2 MP images even on identical-input back-to-back captures, which pushes
// past the global 100 px floor. Real visual changes there measure 1000s+ px.
const THRESHOLD_OVERRIDES = {
  'png-export-themes/': 250,
};

function thresholdFor(rel, defaultThreshold) {
  let best = null;
  for (const prefix of Object.keys(THRESHOLD_OVERRIDES)) {
    if (rel.startsWith(prefix) && (best === null || prefix.length > best.length)) {
      best = prefix;
    }
  }
  return best === null ? defaultThreshold : THRESHOLD_OVERRIDES[best];
}

const [, , baselineDirArg, currentDirArg, thresholdArg] = process.argv;

if (!baselineDirArg || !currentDirArg) {
  console.error('Usage: node diff-baselines.mjs <baselineDir> <currentDir> [pixelThreshold=0]');
  process.exit(2);
}

const baselineDir = path.resolve(baselineDirArg);
const currentDir = path.resolve(currentDirArg);
const threshold = parseInt(thresholdArg ?? '0', 10);

if (baselineDir === currentDir) {
  console.error(`baseline and current resolve to the same path: ${baselineDir}`);
  console.error('They must be distinct — back one up or capture into a separate dir.');
  process.exit(2);
}

if (!existsSync(baselineDir)) {
  console.error(`baseline dir does not exist: ${baselineDir}`);
  process.exit(2);
}
if (!existsSync(currentDir)) {
  console.error(`current dir does not exist: ${currentDir}`);
  process.exit(2);
}

/** Recursively list every .png file under `root`, returning paths relative to root. */
function listPngs(root) {
  const out = [];
  function walk(dir, rel) {
    for (const entry of readdirSync(dir)) {
      // Skip our own diff output to avoid recursive comparisons.
      if (entry === '_diff') continue;
      const abs = path.join(dir, entry);
      const next = path.join(rel, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) walk(abs, next);
      else if (entry.toLowerCase().endsWith('.png')) out.push(next);
    }
  }
  walk(root, '');
  return out.sort();
}

const baselineFilesAll = listPngs(baselineDir);
const currentFiles = listPngs(currentDir);

// Scope baseline to top-level subdirs the snapshot actually wrote into.
// Without this, a regression test that only runs the atelier capture would
// flag every other phase's baseline as a missing-orphan, drowning real
// signals. The snapshot's top-level dirs are the source of truth for
// "what's in scope this run."
const snapshotTopDirs = new Set(currentFiles.map(f => f.split(path.sep)[0]));
const baselineFiles = baselineFilesAll.filter(f => snapshotTopDirs.has(f.split(path.sep)[0]));

const baselineSet = new Set(baselineFiles);
const currentSet = new Set(currentFiles);

const orphansInCurrent = currentFiles.filter(f => !baselineSet.has(f));
const orphansInBaseline = baselineFiles.filter(f => !currentSet.has(f));
const intersection = baselineFiles.filter(f => currentSet.has(f));

const outOfScopeCount = baselineFilesAll.length - baselineFiles.length;

const diffOutDir = path.join(currentDir, '_diff');
const writeDiffPngs = process.env.DIFF_OUT === '1' || process.env.DIFF_OUT === 'true';

let failCount = 0;
const results = [];

for (const rel of intersection) {
  const aBytes = readFileSync(path.join(baselineDir, rel));
  const bBytes = readFileSync(path.join(currentDir, rel));
  let aPng, bPng;
  try {
    aPng = PNG.sync.read(aBytes);
    bPng = PNG.sync.read(bBytes);
  } catch (err) {
    results.push({ rel, status: 'PARSE_ERROR', detail: err.message });
    failCount += 1;
    continue;
  }
  if (aPng.width !== bPng.width || aPng.height !== bPng.height) {
    results.push({
      rel,
      status: 'SIZE_MISMATCH',
      detail: `${aPng.width}x${aPng.height} vs ${bPng.width}x${bPng.height}`,
    });
    failCount += 1;
    continue;
  }
  const diff = new PNG({ width: aPng.width, height: aPng.height });
  const numDiff = pixelmatch(
    aPng.data, bPng.data, diff.data,
    aPng.width, aPng.height,
    { threshold: PIXELMATCH_THRESHOLD, includeAA: false },
  );
  const total = aPng.width * aPng.height;
  const pct = (numDiff / total) * 100;
  const effectiveThreshold = thresholdFor(rel, threshold);
  const failed = numDiff > effectiveThreshold;
  if (failed) failCount += 1;
  results.push({
    rel,
    status: failed ? 'FAIL' : 'OK',
    diffPx: numDiff,
    totalPx: total,
    pct,
    width: aPng.width,
    height: aPng.height,
    threshold: effectiveThreshold,
  });
  if (failed || writeDiffPngs) {
    const outPath = path.join(diffOutDir, rel);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, PNG.sync.write(diff));
  }
}

// ─── Reporting ──────────────────────────────────────────────────────────────

console.log(`baseline:   ${baselineDir}`);
console.log(`current:    ${currentDir}`);
console.log(`threshold:  ${threshold} px (per-pixel tolerance ${PIXELMATCH_THRESHOLD})`);
console.log(`compared:   ${intersection.length} files`);
if (outOfScopeCount > 0) {
  console.log(`out-of-scope: ${outOfScopeCount} baseline files in dirs not covered by this snapshot (skipped)`);
}
console.log('');

const fails = results.filter(r => r.status !== 'OK');
const passes = results.filter(r => r.status === 'OK');

if (fails.length) {
  console.log(`FAILURES (${fails.length}):`);
  for (const r of fails) {
    if (r.status === 'PARSE_ERROR' || r.status === 'SIZE_MISMATCH') {
      console.log(`  ✗ ${r.rel}  [${r.status}]  ${r.detail}`);
    } else {
      console.log(`  ✗ ${r.rel}  ${r.diffPx} px  (${r.pct.toFixed(4)}%)  ${r.width}x${r.height}`);
    }
  }
  console.log('');
}

if (passes.length) {
  console.log(`OK (${passes.length}):`);
  for (const r of passes) {
    console.log(`  ✓ ${r.rel}  ${r.diffPx} px  (${r.pct.toFixed(4)}%)`);
  }
  console.log('');
}

if (orphansInCurrent.length) {
  console.log(`Files in current but not in baseline (${orphansInCurrent.length}):`);
  for (const f of orphansInCurrent) console.log(`  + ${f}`);
  console.log('');
}
if (orphansInBaseline.length) {
  console.log(`Files in baseline but not in current (${orphansInBaseline.length}):`);
  for (const f of orphansInBaseline) console.log(`  - ${f}`);
  console.log('');
}

if (failCount > 0 && existsSync(diffOutDir)) {
  console.log(`Diff PNGs written to: ${diffOutDir}`);
  console.log('Open these to see exactly which pixels differ (red = changed).');
}

const orphanCount = orphansInCurrent.length + orphansInBaseline.length;

if (failCount > 0) process.exit(1);
if (orphanCount > 0) process.exit(3);
process.exit(0);
