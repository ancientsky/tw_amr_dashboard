"""Helpers shared by the skeleton mappers for reports that have NOT been supplied yet (AMU, HAI/TNIS)."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXTRACTED = ROOT / "data" / "source" / "extracted"
CURATED = ROOT / "data" / "curated"
ROC = re.compile(r"(1[0-2]\d)\s*年")


def roc_to_ce(text: str) -> int | None:
    m = ROC.search(text or "")
    return int(m.group(1)) + 1911 if m else None


def load_tables(pdf_stem_glob: str):
    """Yield (pdf_dir, page, path, rows) for every extracted table CSV."""
    for d in sorted(EXTRACTED.glob(pdf_stem_glob)):
        for f in sorted(d.glob("p*-*.csv")):
            page = int(f.name[1:4])
            with f.open(encoding="utf-8") as fh:
                yield d, page, f, list(csv.reader(fh))


def match_header(cell: str, vocab: dict[str, list[str]]) -> str | None:
    """Return the canonical code whose synonyms appear in a header cell."""
    c = re.sub(r"\s+", "", (cell or "").lower())
    for code, syns in vocab.items():
        if any(re.sub(r"\s+", "", s.lower()) in c for s in syns):
            return code
    return None


def to_num(s: str):
    s = (s or "").replace(",", "").replace("%", "").replace("‰", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def write_curated(name: str, cols: list[str], rows: list[dict]):
    with (CURATED / f"{name}.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def set_status(dataset: str, status: str, **extra):
    """Record mapper outcome. build_data.py flips provisional -> false only for status 'ingested'
    AND no remaining origin=model rows in the curated CSV."""
    p = CURATED / "_provenance.json"
    prov = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"datasets": {}}
    prov.setdefault("datasets", {})[dataset] = {"status": status, **extra}
    p.write_text(json.dumps(prov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
