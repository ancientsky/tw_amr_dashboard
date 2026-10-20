#!/usr/bin/env python3
"""Parse the 貳 section isolate-count tables (表 2-1, 表 2-2-x, 表 2-3-x) of the
臺灣抗生素抗藥性監視年報 from the PDF *text layer* into
data/source/transcribed/<report_year>/isolate_counts.csv.

Input: a `pdftotext -layout` dump (pages separated by \\f) or the PDF itself
(pdftotext is invoked if a .pdf is given). Report year is auto-detected from the
"Annual Report, Taiwan YYYY" footer unless --report-year is supplied.

Usage:
  python3 scripts/ingest/parse_isolate_tables.py raw/*.pdf
  python3 scripts/ingest/parse_isolate_tables.py --text report3.txt --report-year 2024
"""
from __future__ import annotations

import argparse
import csv
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_BASE = ROOT / "data" / "source" / "transcribed"
HEADER = ["report_year", "scope", "organism", "data_year", "rank", "isolates", "pdf_page", "table"]

# table number -> scope
SCOPE_BY_TABLE = {
    "2-1": "all",
    "2-2-1": "blood", "2-2-2": "urine", "2-2-3": "sputum", "2-2-4": "pus", "2-2-5": "stool",
    "2-3-1": "co", "2-3-2": "ho",
}
CAPTION_RE = re.compile(r"^\s*表\s*(2-\d(?:-\d)?)、\s*(\d{3})\s*至\s*(\d{3})\s*年(.*)$")
YEARS_RE = re.compile(r"(\d{3})年")
NUM_RE = re.compile(r"^\d{1,3}(?:,\d{3})*$|^\d+$")
SPECIAL = {"其他": "Other", "總計": "Total", "合計": "Total"}


def read_pages(path: Path) -> list[str]:
    if path.suffix.lower() == ".pdf":
        out = subprocess.run(["pdftotext", "-layout", str(path), "-"], check=True,
                             capture_output=True).stdout.decode("utf-8", "replace")
    else:
        out = path.read_text(encoding="utf-8")
    return out.split("\f")


def detect_report_year(pages: list[str]) -> int | None:
    for p in pages[:40]:
        m = re.search(r"Annual Report,\s*Taiwan\s*(20\d\d)", p)
        if m:
            return int(m.group(1))
    return None


def parse_row(line: str, nyears: int):
    """Split a layout line into (organism, [(rank|None, count)] * nyears) or None."""
    s = line.rstrip()
    if not s.strip():
        return None
    # organism = leading text up to the first run of 2+ spaces followed by a digit
    m = re.match(r"^\s*(.+?)\s{2,}(\d[\d,\s]*)$", s)
    if not m:
        return None
    name = m.group(1).strip()
    toks = m.group(2).split()
    if not all(NUM_RE.match(t) for t in toks):
        return None
    nums = [int(t.replace(",", "")) for t in toks]
    if len(nums) == 2 * nyears:
        pairs = [(nums[2 * i], nums[2 * i + 1]) for i in range(nyears)]
        # sanity: ranks are small, counts larger or equal
        if all(r <= 60 for r, _ in pairs):
            return name, pairs
    if len(nums) == nyears:
        return name, [(None, n) for n in nums]
    # mixed (some years lack a rank): use column positions -> heuristic: a rank is <= 60
    # and is immediately followed by a count; fall back to failure.
    out, i = [], 0
    while i < len(nums) and len(out) < nyears:
        if i + 1 < len(nums) and nums[i] <= 60 and ("," in toks[i + 1] or nums[i + 1] > 60):
            out.append((nums[i], nums[i + 1])); i += 2
        else:
            out.append((None, nums[i])); i += 1
    if len(out) == nyears and i == len(nums):
        return name, out
    return None


def parse_pages(pages: list[str], report_year: int, warn) -> list[dict]:
    rows: list[dict] = []
    seen_tables: set[str] = set()
    for pidx, page in enumerate(pages, start=1):
        lines = page.split("\n")
        for li, line in enumerate(lines):
            m = CAPTION_RE.match(line)
            if not m or "....." in line:
                continue
            tno = m.group(1)
            if tno not in SCOPE_BY_TABLE or tno in seen_tables:
                continue
            # find year header
            years = None
            j = li + 1
            while j < len(lines) and j < li + 8:
                ys = YEARS_RE.findall(lines[j])
                if len(ys) >= 3:
                    years = [int(y) + 1911 for y in ys]
                    break
                j += 1
            if not years:
                warn(f"p{pidx} 表{tno}: year header not found")
                continue
            seen_tables.add(tno)
            n = 0
            for line2 in lines[j + 1:]:
                if line2.strip().startswith("註") or CAPTION_RE.match(line2):
                    break
                parsed = parse_row(line2, len(years))
                if not parsed:
                    continue
                name, pairs = parsed
                organism = SPECIAL.get(name, name)
                for y, (rank, cnt) in zip(years, pairs):
                    rows.append({"report_year": report_year, "scope": SCOPE_BY_TABLE[tno],
                                 "organism": organism, "data_year": y,
                                 "rank": "" if rank is None else rank, "isolates": cnt,
                                 "pdf_page": pidx, "table": f"表{tno}"})
                n += 1
            if n == 0:
                warn(f"p{pidx} 表{tno}: no rows parsed")
    missing = set(SCOPE_BY_TABLE) - seen_tables
    if missing:
        warn(f"report {report_year}: tables not found: {sorted(missing)}")
    return rows


def check_totals(rows: list[dict], warn) -> None:
    """Verify sum(organisms incl. Other) == Total for every (scope, year)."""
    from collections import defaultdict
    sums, totals = defaultdict(int), {}
    for r in rows:
        k = (r["scope"], r["data_year"])
        if r["organism"] == "Total":
            totals[k] = r["isolates"]
        else:
            sums[k] += r["isolates"]
    for k, t in sorted(totals.items()):
        if sums[k] != t:
            warn(f"total mismatch {k}: sum={sums[k]} total={t} (diff {t - sums[k]})")


def write_csv(rows: list[dict], report_year: int) -> Path:
    out = OUT_BASE / str(report_year) / "isolate_counts.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    order = {s: i for i, s in enumerate(SCOPE_BY_TABLE.values())}
    rows = sorted(rows, key=lambda r: (order[r["scope"]], r["data_year"],
                                       r["organism"] in ("Other", "Total"), r["organism"] == "Total",
                                       r["rank"] if r["rank"] != "" else 999, r["organism"]))
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=HEADER, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="*", help="PDF files or pdftotext -layout dumps")
    ap.add_argument("--text", action="append", default=[], help="text dump (repeatable)")
    ap.add_argument("--report-year", type=int, action="append", default=[],
                    help="report year for each input, in order (default: auto-detect)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    inputs = [Path(p) for p in args.inputs + args.text]
    if not inputs:
        ap.error("no inputs")
    problems = 0

    for i, path in enumerate(inputs):
        pages = read_pages(path)
        ry = args.report_year[i] if i < len(args.report_year) else detect_report_year(pages)
        if not ry:
            print(f"[isolates] {path}: cannot detect report year; pass --report-year", file=sys.stderr)
            return 2
        msgs: list[str] = []
        rows = parse_pages(pages, ry, msgs.append)
        notes: list[str] = []
        check_totals(rows, notes.append)
        for m in msgs:
            print(f"[isolates] WARN {ry}: {m}", file=sys.stderr)
        for m in notes:  # source-table inconsistencies (rows do not add up to 總計) — not parse errors
            print(f"[isolates] NOTE {ry}: {m} (as printed in the source table)", file=sys.stderr)
        problems += len(msgs)
        if args.dry_run:
            print(f"[isolates] {path.name}: report {ry}: {len(rows)} rows (dry run)")
        else:
            out = write_csv(rows, ry)
            print(f"[isolates] {path.name}: report {ry}: {len(rows)} rows -> {out.relative_to(ROOT)}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
