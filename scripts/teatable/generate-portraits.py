#!/usr/bin/env python3
"""
Generate ink-brush portrait illustrations for the Tea-Table theme via Azure
gpt-image-2.

14 honor archetypes + 1 profile fallback. Outputs JPEG to
public/themes/teatable/honors/<key>.jpg with vertical portrait aspect
(1024x1536 native, scaled in CSS to ~70x88 fit).

Credentials loaded from ~/.config/gpt-image/credentials (KEY=VALUE, no quotes).

Usage:
  python scripts/teatable/generate-portraits.py
  python scripts/teatable/generate-portraits.py --only lubu zhanji   # subset
  python scripts/teatable/generate-portraits.py --concurrency 5      # default

Output is non-deterministic — gpt-image doesn't expose a seed. Re-run if a
particular character comes back wrong; pass --only <key> to regen just that one.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "public" / "themes" / "teatable" / "honors"
CREDENTIALS_PATH = Path.home() / ".config" / "gpt-image" / "credentials"

STYLE_PREFIX = (
    "Traditional Chinese ink-wash portrait painting (水墨画). "
    "Black sumi ink on aged warm-toned rice paper. "
    "Confident single-stroke linework, minimal but expressive detail. "
    "Vertical scroll composition, upper body and face only. "
    "Subdued sepia / warm graphite palette, no bright colors. "
    "A small vermillion red square seal in the lower-right corner. "
    "No text, no Western fonts, no signature words. "
    "The figure is ARCHETYPE: "
)

# 16 honors + 1 generic profile fallback. Key matches the data-honor-id values
# in index.html (the renderer's HONOR_META keys in src/stats/honors.js).
HONORS = {
    "lyubu": (
        "the legendary Three Kingdoms general Lü Bu — fierce mounted warrior, "
        "elaborate plumed helmet, eyes blazing with battle fury, halberd "
        "tip just visible at the edge"
    ),
    "adou": (
        "the bewildered young prince A-Dou — soft-faced, oversized royal "
        "headdress slightly askew, vacant slack-jawed expression, robes "
        "comically too large"
    ),
    "shifo": (
        "a stone-Buddha monk in deep meditation — eyes closed, serene "
        "half-smile, weathered ageless face, hands in dhyana mudra at chest, "
        "lotus position implied"
    ),
    "bodongwang": (
        "a wild-eyed turbulent warrior surrounded by violent crashing waves, "
        "hair whipping in the storm, sleeves billowing chaotically"
    ),
    "fendouwang": (
        "a determined mountain climber mid-ascent — fist raised, brow "
        "furrowed in effort, sweat-streaked face, rope coiled across "
        "shoulder, eyes locked on a distant peak"
    ),
    "fanchewang": (
        "an unfortunate scholar tumbling head-over-heels in mid-fall, "
        "loose scrolls and hat scattering through the air around him, "
        "comically alarmed expression"
    ),
    "dutu": (
        "a smirking gambler leaning over a low table with three rolling dice, "
        "one eyebrow raised, wide-brimmed hat tilted, a single coin spinning "
        "on its edge near his hand"
    ),
    "damanguan": (
        "a triumphant champion at the moment of victory — arms thrown wide "
        "to the sky, an unfurled scroll of achievement clutched in one hand, "
        "joyous open-mouthed shout"
    ),
    "lianshengewang": (
        "a stoic veteran warrior with sword raised in salute, calm victorious "
        "smile, layered armor plates suggested with confident strokes, "
        "tassels on the sword hilt"
    ),
    "foxiwanjia": (
        "a barefoot wandering zen monk strolling unhurriedly, half-smile of "
        "detachment, rough hempen robes, walking staff over one shoulder, "
        "completely at peace"
    ),
    "liyuwang": (
        "a leaping carp transforming into a dragon, mid-leap arc above "
        "stylized water waves, fish-scaled body curving upward, the merest "
        "hint of dragon horns and whiskers beginning to form"
    ),
    "buzhanguo": (
        "a serenely smiling figure in plain robes, water droplets sliding "
        "off the shoulders without leaving a mark — a person who lets all "
        "trouble slide off, calm unbothered expression"
    ),
    "shandianxia": (
        "a blurred lightning-fast figure mid-dash, motion streaks trailing "
        "behind him, robes whipping forward, jagged calligraphic lightning-bolt "
        "strokes radiating from his form, face barely visible through the speed"
    ),
    "ranjinwang": (
        "an exhausted warrior collapsed forward on the haft of a broken spear, "
        "armor smoking with the last embers of effort, sweat and ash streaks, "
        "the look of total burnout after giving everything"
    ),
    "qichayizhao": (
        "a focused weiqi (Go) player frozen in mid-thought over a board, "
        "stone pinched between fingertips just above the grid, dawning "
        "dismay in the eyes — one move short of victory"
    ),
    "xiaochou": (
        "a stylized opera clown with traditional jingju face paint, "
        "exaggerated comedic features, mouth in a wide goofy grin, holding "
        "a folding fan, theatrical pose — the everyman jester archetype"
    ),
    "_profile": (
        "a contemplative Chinese tea-drinking scholar with kind eyes and a "
        "small smile, holding a small ceramic tea cup at chest height, "
        "wearing a loose simple robe, reflective and welcoming expression — "
        "this is a neutral default portrait for any player"
    ),
}


def load_credentials() -> dict[str, str]:
    if not CREDENTIALS_PATH.exists():
        sys.exit(f"Credentials file not found: {CREDENTIALS_PATH}")
    creds: dict[str, str] = {}
    for line in CREDENTIALS_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip().strip('"').strip("'")
    return creds


def gen_one(name: str, archetype_phrase: str, creds: dict[str, str], retries: int = 2) -> Path:
    prompt = STYLE_PREFIX + archetype_phrase + "."
    endpoint = creds["AZURE_OPENAI_ENDPOINT"].rstrip("/") + "/images/generations"
    body = json.dumps(
        {
            "model": creds.get("AZURE_OPENAI_DEPLOYMENT", "gpt-image-2-1"),
            "prompt": prompt,
            "size": "1024x1536",
            "n": 1,
        }
    ).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "api-key": creds["AZURE_OPENAI_API_KEY"],
    }
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = json.loads(resp.read())
            b64 = data["data"][0]["b64_json"]
            out_path = OUTPUT_DIR / f"{name}.jpg"
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(base64.b64decode(b64))
            return out_path
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:500]
            last_err = RuntimeError(f"HTTP {e.code} for {name}: {err_body}")
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(5 * (attempt + 1))
                continue
            raise last_err from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    if last_err:
        raise last_err
    raise RuntimeError(f"unreachable for {name}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="Subset of honor keys to regen")
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument(
        "--skip-existing", action="store_true",
        help="Skip honor keys that already have a JPG (resume mode)"
    )
    args = parser.parse_args()

    creds = load_credentials()
    if "AZURE_OPENAI_ENDPOINT" not in creds or "AZURE_OPENAI_API_KEY" not in creds:
        sys.exit("Credentials missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY")

    keys = list(HONORS.keys())
    if args.only:
        unknown = set(args.only) - set(keys)
        if unknown:
            sys.exit(f"Unknown keys: {sorted(unknown)} (valid: {sorted(keys)})")
        keys = list(args.only)

    if args.skip_existing:
        before = len(keys)
        keys = [k for k in keys if not (OUTPUT_DIR / f"{k}.jpg").exists()]
        skipped = before - len(keys)
        if skipped:
            print(f"Skipping {skipped} existing files (resume mode)")

    if not keys:
        print("Nothing to generate.")
        return 0

    print(f"Generating {len(keys)} portraits with concurrency={args.concurrency}")
    print(f"Output dir: {OUTPUT_DIR}")

    started = time.time()
    failures: list[str] = []
    completed: list[str] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futs = {
            ex.submit(gen_one, k, HONORS[k], creds): k
            for k in keys
        }
        for fut in concurrent.futures.as_completed(futs):
            key = futs[fut]
            try:
                path = fut.result()
                size_kb = path.stat().st_size // 1024
                elapsed = int(time.time() - started)
                completed.append(key)
                print(f"  ✓ [{len(completed)}/{len(keys)}] {key:18s} {size_kb:5d} KB  (t+{elapsed}s)")
            except Exception as e:
                failures.append(key)
                print(f"  ✗ {key}: {e}", file=sys.stderr)

    total = int(time.time() - started)
    print(f"\nDone in {total}s. {len(completed)} ok, {len(failures)} failed.")
    if failures:
        print(f"Failed: {failures}")
        print(f"Re-run with: python {sys.argv[0]} --only {' '.join(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
