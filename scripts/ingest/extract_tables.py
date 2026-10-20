#!/usr/bin/env python3
"""Generic PDF table/text extractor (pdfplumber).

For every input PDF writes
  data/source/extracted/<pdf-stem>/text.txt            full text, one '\\f' per page (pdftotext -layout if available,
                                                       else pdfplumber's layout text)
  data/source/extracted/<pdf-stem>/p<NNN>-<k>.csv      every table pdfplumber detects (NNN = 1-based PDF page index)
  data/source/extracted/<pdf-stem>/index.json          page -> table list with shapes and the nearest 表/圖 caption

The THAS antibiogram figures are vector graphics whose numbers are in the text layer, but their grid is not always
detected as a table; use --strategy text for those pages. Charts with raster numbers need visual transcription
(see docs/TRANSCRIPTION.md).

Usage:
  python3 scripts/ingest/extract_tables.py raw/*.pdf
  python3 scripts/ingest/extract_tables.py raw/x.pdf --pages 20-40 --strategy text --out data/source/extracted
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAPTION = re.compile(r"((?:表|圖)\s*[\d\-]+[^\n]{0,60})")


def parse_pages(spec: str | None, n: int) -> list[int]:
    if not spec:
        return list(range(1, n + 1))
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += list(range(int(a), int(b or a) + 1))
    return [p for p in out if 1 <= p <= n]


def slug(stem: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", stem, flags=re.UNICODE).strip("_")
    return s or "pdf"


def extract(pdf: Path, out_base: Path, pages_spec: str | None, strategy: str, min_rows: int) -> dict:
    import pdfplumber
    out = out_base / slug(pdf.stem)
    out.mkdir(parents=True, exist_ok=True)
    settings = {"vertical_strategy": strategy, "horizontal_strategy": strategy}
    index = {"pdf": pdf.name, "strategy": strategy, "pages": {}}
    with pdfplumber.open(pdf) as doc:
        pages = parse_pages(pages_spec, len(doc.pages))
        texts = []
        for pno in pages:
            page = doc.pages[pno - 1]
            text = page.extract_text(layout=True) or ""
            texts.append(text)
            caps = CAPTION.findall(text)
            tables = []
            for k, tbl in enumerate(page.extract_tables(table_settings=settings), 1):
                rows = [[(c or "").replace("\n", " ").strip() for c in row] for row in tbl]
                rows = [r for r in rows if any(r)]
                if len(rows) < min_rows:
                    continue
                f = out / f"p{pno:03d}-{k}.csv"
                with f.open("w", encoding="utf-8", newline="") as fh:
                    csv.writer(fh, lineterminator="\n").writerows(rows)
                tables.append({"file": f.name, "rows": len(rows), "cols": max(len(r) for r in rows)})
            if tables or caps:
                index["pages"][str(pno)] = {"captions": caps[:6], "tables": tables}
    if shutil.which("pdftotext") and not pages_spec:
        txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, check=True).stdout.decode("utf-8", "replace")
    else:
        txt = "\f".join(texts)
    (out / "text.txt").write_text(txt, encoding="utf-8")
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = sum(len(p["tables"]) for p in index["pages"].values())
    print(f"[extract] {pdf.name}: {len(pages)} pages, {n} tables -> {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    return index


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdfs", nargs="+", type=Path)
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "source" / "extracted")
    ap.add_argument("--pages", help="e.g. 1-10,22,40-45 (1-based PDF page index)")
    ap.add_argument("--strategy", choices=["lines", "text"], default="lines")
    ap.add_argument("--min-rows", type=int, default=2)
    a = ap.parse_args(argv)
    try:
        import pdfplumber  # noqa: F401
    except ImportError:
        print("pdfplumber is required: pip install -r scripts/requirements.txt", file=sys.stderr)
        return 2
    for pdf in a.pdfs:
        if not pdf.exists():
            print(f"[extract] missing {pdf}", file=sys.stderr)
            return 1
        extract(pdf, a.out, a.pages, a.strategy, a.min_rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
