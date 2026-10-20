#!/usr/bin/env python3
"""Map the transcribed THAS AR annual-report CSVs -> canonical curated tables.

Inputs  (any subset may be missing; missing files are skipped with a warning):
  data/source/transcribed/<report_year>/antibiogram.csv          (圖 3-1-x, %S + n)       -> precision 'table'
  data/source/transcribed/<report_year>/pathogen_resistance.csv  (圖 3-2-x, %R)           -> 'text' | 'chart_estimate'
  data/source/transcribed/<report_year>/mdro_trends.csv          (圖 4-x-y-2, MDRO %R)     -> phenotype rows
  data/source/transcribed/<report_year>/mdro_counts.csv          (圖 4-x-y-1, isolates)    -> isolates.csv
  data/source/transcribed/<report_year>/isolate_counts.csv       (表 2-x, isolates/rank)   -> isolates.csv
  data/curated/resistance_overrides.csv  (optional manual corrections; same columns as the output, applied last)

Outputs:
  data/curated/resistance.csv, data/curated/isolates.csv   (canonical long tables, + `source_ref` audit column)
  data/curated/_dedup_log.csv                                (every superseded duplicate and why)
  data/curated/_provenance.json                              (per-dataset status/coverage; read by build_data.py)

De-duplication: the same key (year, pathogen, antibiotic, phenotype, level, ward, setting, specimen) can appear in
several report editions (e.g. MDRO trends 2019–2022 appear in the 2022, 2023 and 2024 reports) and in several figure
types. The winner is the row with the newest report year, then the highest precision (table > text > chart_estimate).

Usage: python3 scripts/ingest/map_amr.py [--transcribed DIR] [--out DIR] [--quiet]
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vocab import (PRECISION_RANK, ROOT, precision_from_read_method, to_float,  # noqa: E402
                   to_int, vocab)

TRANSCRIBED = ROOT / "data" / "source" / "transcribed"
CURATED = ROOT / "data" / "curated"
RAW = ROOT / "raw"

RES_COLS = ["year", "pathogen", "antibiotic", "phenotype", "level", "ward", "setting", "specimen",
            "isolates", "resistant_pct", "susceptible_pct", "ci_low", "ci_high", "precision", "reportYear", "source_ref"]
ISO_COLS = ["year", "organism", "scope", "level", "subset", "rank", "isolates", "precision", "reportYear", "source_ref"]
# MDRO count charts split bars into susceptible / non-susceptible: "<organism> (I+R)" / "[I+R]" and "(S)" / "[S]"
SUBSET_SUFFIX = re.compile(r"\s*[\(\[]\s*(I\s*\+\s*R|S)\s*[\)\]]\s*$", re.I)
DEDUP_COLS = ["dataset", "key", "kept_value", "kept_reportYear", "kept_precision", "kept_ref",
              "dropped_value", "dropped_reportYear", "dropped_precision", "dropped_ref", "delta"]

INPUT_FILES = ["antibiogram.csv", "pathogen_resistance.csv", "mdro_trends.csv", "mdro_counts.csv", "isolate_counts.csv"]


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(fh)]


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:.10g}"
    return str(v)


def r1(x: float | None) -> float | None:
    return None if x is None else round(x + 0.0, 1)


class Mapper:
    def __init__(self, transcribed: Path, warn):
        self.dir = transcribed
        self.warn = warn
        self.v = vocab()
        self.res: list[dict] = []
        self.iso: list[dict] = []
        self.files_used: list[dict] = []
        self.skipped = Counter()

    # ---------------- helpers ----------------
    def _report_dirs(self):
        if not self.dir.exists():
            return []
        return sorted([p for p in self.dir.iterdir() if p.is_dir() and p.name.isdigit()], key=lambda p: p.name)

    def _ref(self, ry, row, fig_key="figure"):
        page = row.get("pdf_page", "")
        fig = row.get(fig_key, "") or row.get("table", "")
        return f"{ry}/p{page}/{fig}".replace(" ", "")

    def _year(self, s, where):
        y = to_int(s)
        if y is None:
            return None
        if 100 <= y <= 200:  # ROC year slipped through
            self.warn(f"{where}: ROC year {y} converted to {y + 1911}")
            y += 1911
        if not 2000 <= y <= 2100:
            self.warn(f"{where}: implausible year {s!r}; row skipped")
            return None
        return y

    def _level(self, s, where):
        lv = self.v.simple("levels", s, default="all")
        if lv is None:
            self.warn(f"{where}: unknown level {s!r}; row skipped")
        return lv

    def _setting(self, s, where):
        st = self.v.simple("settings", s, default="all")
        if st is None:
            self.warn(f"{where}: unknown infection_setting {s!r}; row skipped")
        return st

    def _specimen(self, s, where):
        sp = self.v.simple("specimens", s, default="all")
        if sp is None:
            self.warn(f"{where}: unknown specimen {s!r}; row skipped")
        return sp

    # ---------------- readers ----------------
    def run(self):
        dirs = self._report_dirs()
        if not dirs:
            self.warn(f"no transcription folders under {self.dir.relative_to(ROOT) if self.dir.is_relative_to(ROOT) else self.dir}")
        for d in dirs:
            ry = int(d.name)
            for fname in INPUT_FILES:
                path = d / fname
                if not path.exists():
                    self.warn(f"{ry}/{fname}: not present yet - skipped")
                    continue
                rows = read_csv(path)
                n_before = (len(self.res), len(self.iso))
                getattr(self, "read_" + fname.replace(".csv", ""))(ry, rows, f"{ry}/{fname}")
                added = (len(self.res) - n_before[0]) + (len(self.iso) - n_before[1])
                self.files_used.append({"file": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path), "rows": len(rows), "mapped": added,
                                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        self.apply_overrides()

    def read_antibiogram(self, ry, rows, where):
        for i, r in enumerate(rows, 2):
            w = f"{where}:{i}"
            year = self._year(r.get("data_year"), w)
            lv = self._level(r.get("level"), w)
            path = self.v.organism(r.get("pathogen", ""), self.warn)
            if path == "SAL":  # 2022 edition prints the NTS antibiogram row as "Salmonella spp."
                path = "NTS"
            abx = self.v.antibiotic(r.get("antibiotic_abbr"), r.get("antibiotic"), self.warn)
            s = to_float(r.get("susceptible_pct"))
            if None in (year, lv, path, abx) or s is None:
                self.skipped[where] += 1
                continue
            if not 0 <= s <= 100:
                self.warn(f"{w}: susceptible_pct {s} out of range; skipped"); self.skipped[where] += 1; continue
            self.res.append({"year": year, "pathogen": path, "antibiotic": abx, "phenotype": None, "level": lv,
                             "ward": "all", "setting": "all", "specimen": "all", "isolates": to_int(r.get("isolates")),
                             "resistant_pct": r1(100.0 - s), "susceptible_pct": r1(s), "ci_low": None, "ci_high": None,
                             "precision": "table", "reportYear": ry, "source_ref": self._ref(ry, r)})

    def read_pathogen_resistance(self, ry, rows, where):
        for i, r in enumerate(rows, 2):
            w = f"{where}:{i}"
            prec = precision_from_read_method(r.get("read_method"))
            pct = to_float(r.get("resistant_pct"))
            if prec is None or pct is None:
                self.skipped[where] += 1
                continue
            year = self._year(r.get("data_year"), w)
            path = self.v.organism(r.get("pathogen", ""), self.warn)
            abx = self.v.antibiotic(r.get("antibiotic_abbr"), r.get("antibiotic"), self.warn)
            st = self._setting(r.get("infection_setting"), w)
            sp = self._specimen(r.get("specimen"), w)
            lv = self._level(r.get("level", "all"), w)
            if None in (year, path, abx, st, sp, lv) or not 0 <= pct <= 100:
                self.skipped[where] += 1
                continue
            self.res.append({"year": year, "pathogen": path, "antibiotic": abx, "phenotype": None, "level": lv,
                             "ward": "all", "setting": st, "specimen": sp, "isolates": to_int(r.get("isolates")),
                             "resistant_pct": r1(pct), "susceptible_pct": None,
                             "ci_low": r1(to_float(r.get("ci_low"))), "ci_high": r1(to_float(r.get("ci_high"))),
                             "precision": prec, "reportYear": ry, "source_ref": self._ref(ry, r)})

    def read_mdro_trends(self, ry, rows, where):
        for i, r in enumerate(rows, 2):
            w = f"{where}:{i}"
            prec = precision_from_read_method(r.get("read_method"))
            pct = to_float(r.get("resistant_pct"))
            if prec is None or pct is None:
                self.skipped[where] += 1
                continue
            ph = self.v.phenotype(r.get("phenotype", ""))
            if ph is None:
                self.warn(f"{w}: unknown phenotype {r.get('phenotype')!r} (add to dims/phenotypes.json); skipped")
                self.skipped[where] += 1
                continue
            meta = self.v.pheno_by_code[ph]["meta"]
            year = self._year(r.get("data_year"), w)
            st = self._setting(r.get("infection_setting"), w)
            lv = self._level(r.get("level"), w)
            sp = self._specimen(r.get("specimen", "all"), w)
            if None in (year, st, lv, sp) or not 0 <= pct <= 100:
                self.skipped[where] += 1
                continue
            self.res.append({"year": year, "pathogen": meta["pathogen"], "antibiotic": meta["antibiotic"], "phenotype": ph,
                             "level": lv, "ward": "all", "setting": st, "specimen": sp, "isolates": None,
                             "resistant_pct": r1(pct), "susceptible_pct": None, "ci_low": None, "ci_high": None,
                             "precision": prec, "reportYear": ry, "source_ref": self._ref(ry, r)})

    def read_mdro_counts(self, ry, rows, where):
        for i, r in enumerate(rows, 2):
            w = f"{where}:{i}"
            prec = precision_from_read_method(r.get("read_method"))
            n = to_int(r.get("isolates"))
            if prec is None or n is None:
                self.skipped[where] += 1
                continue
            year = self._year(r.get("data_year"), w)
            name = r.get("organism", "")
            m = SUBSET_SUFFIX.search(name)  # "(I+R)"/"[S]" rows are subset counts, NOT totals
            subset = None if not m else ("I+R" if "R" in m.group(1).upper() else "S")
            org = self.v.organism(SUBSET_SUFFIX.sub("", name), self.warn)
            st = self._setting(r.get("infection_setting"), w)
            lv = self._level(r.get("level"), w)
            if None in (year, org, st, lv):
                self.skipped[where] += 1
                continue
            self.iso.append({"year": year, "organism": org, "scope": st, "level": lv, "subset": subset,
                             "rank": None, "isolates": n,
                             "precision": prec, "reportYear": ry, "source_ref": self._ref(ry, r)})

    def read_isolate_counts(self, ry, rows, where):
        for i, r in enumerate(rows, 2):
            w = f"{where}:{i}"
            year = self._year(r.get("data_year"), w)
            org = self.v.organism(r.get("organism", ""), self.warn)
            scope = (r.get("scope") or "").strip().lower()
            n = to_int(r.get("isolates"))
            if scope not in {"all", "blood", "urine", "sputum", "pus", "stool", "co", "ho"}:
                self.warn(f"{w}: unknown scope {scope!r}; skipped"); self.skipped[where] += 1; continue
            if None in (year, org, n):
                self.skipped[where] += 1
                continue
            self.iso.append({"year": year, "organism": org, "scope": scope, "level": "all", "rank": to_int(r.get("rank")),
                             "isolates": n, "precision": "table", "reportYear": ry, "subset": None,
                             "source_ref": self._ref(ry, r, "table"), "_table": True})

    def apply_overrides(self):
        path = CURATED / "resistance_overrides.csv"
        if not path.exists():
            return
        for i, r in enumerate(read_csv(path), 2):
            if not r.get("year"):
                continue
            row = {c: (r.get(c) or None) for c in RES_COLS}
            for c in ("year", "isolates", "reportYear"):
                row[c] = to_int(row[c])
            for c in ("resistant_pct", "susceptible_pct", "ci_low", "ci_high"):
                row[c] = to_float(row[c])
            row["ward"] = row["ward"] or "all"
            row["setting"] = row["setting"] or "all"
            row["specimen"] = row["specimen"] or "all"
            row["precision"] = row["precision"] or "table"
            row["reportYear"] = row["reportYear"] or 9999  # overrides always win
            row["source_ref"] = row["source_ref"] or f"override:{i}"
            self.res.append(row)

    # ---------------- de-duplication ----------------
    @staticmethod
    def _rank(r):
        return (r["reportYear"] or 0, PRECISION_RANK.get(r["precision"], 0))

    def dedup(self, rows, keyf, valf, dataset, log):
        best: dict[tuple, dict] = {}
        for r in rows:
            k = keyf(r)
            cur = best.get(k)
            if cur is None:
                best[k] = r
                continue
            win, lose = (r, cur) if self._rank(r) > self._rank(cur) else (cur, r)
            best[k] = win
            dv = None if valf(win) is None or valf(lose) is None else round(valf(win) - valf(lose), 2)
            log.append({"dataset": dataset, "key": "|".join(fmt(x) for x in k), "kept_value": fmt(valf(win)),
                        "kept_reportYear": win["reportYear"], "kept_precision": win["precision"], "kept_ref": win["source_ref"],
                        "dropped_value": fmt(valf(lose)), "dropped_reportYear": lose["reportYear"],
                        "dropped_precision": lose["precision"], "dropped_ref": lose["source_ref"], "delta": fmt(dv)})
        return list(best.values())

    def whole_tables(self, log):
        """Isolate-count tables (表 2-x) are ranked top-N lists: mixing rows from different editions would leak
        organisms ranked only in an older edition (and double count them inside 'Other'). So for every
        (year, scope, level) take the complete table from the newest edition that has it."""
        newest = {}
        for r in self.iso:
            if r.get("_table"):
                k = (r["year"], r["scope"], r["level"])
                newest[k] = max(newest.get(k, 0), r["reportYear"])
        keep = []
        for r in self.iso:
            if r.get("_table") and r["reportYear"] != newest[(r["year"], r["scope"], r["level"])]:
                log.append({"dataset": "isolates", "key": "|".join(fmt(x) for x in (r["year"], r["organism"], r["scope"], r["level"])),
                            "kept_value": "", "kept_reportYear": newest[(r["year"], r["scope"], r["level"])], "kept_precision": "table",
                            "kept_ref": "whole table from newer edition", "dropped_value": fmt(r["isolates"]),
                            "dropped_reportYear": r["reportYear"], "dropped_precision": r["precision"], "dropped_ref": r["source_ref"],
                            "delta": ""})
                continue
            keep.append(r)
        for r in keep:
            r.pop("_table", None)
        self.iso = keep

    def finalize(self):
        log: list[dict] = []
        self.whole_tables(log)
        res = self.dedup(self.res, lambda r: (r["year"], r["pathogen"], r["antibiotic"], r["phenotype"] or "", r["level"],
                                              r["ward"], r["setting"], r["specimen"]),
                         lambda r: r["resistant_pct"], "resistance", log)
        iso = self.dedup(self.iso, lambda r: (r["year"], r["organism"], r["scope"], r["level"], r.get("subset") or ""),
                         lambda r: r["isolates"], "isolates", log)
        # fill MDRO phenotype denominators from total (never I+R / S subset) organism counts of the same organism/setting/level/year
        counts = {(r["year"], r["organism"], r["scope"], r["level"]): r["isolates"] for r in iso if not r.get("subset")}
        for r in res:
            if r["phenotype"] and r["isolates"] is None and r["specimen"] == "all":
                r["isolates"] = counts.get((r["year"], r["pathogen"], r["setting"], r["level"]))
        for r in res:
            if r["reportYear"] == 9999:
                r["reportYear"] = None
        v = self.v
        po = {o["code"]: o["order"] for o in v.organisms}
        ao = {a["code"]: a["order"] for a in v.antibiotics}
        lo = {d["code"]: d["order"] for d in v.levels}
        so = {d["code"]: d["order"] for d in v.settings}
        spo = {d["code"]: d["order"] for d in v.specimens}
        pho = {p["code"]: p["order"] for p in v.phenotypes}
        res.sort(key=lambda r: (po.get(r["pathogen"], 999), r["pathogen"], pho.get(r["phenotype"], -1) if r["phenotype"] else -1,
                                ao.get(r["antibiotic"], 999), r["antibiotic"], lo[r["level"]], so[r["setting"]],
                                spo.get(r["specimen"], 99), r["year"]))
        scope_o = {s: i for i, s in enumerate(["all", "blood", "urine", "sputum", "pus", "stool", "co", "ho"])}
        iso.sort(key=lambda r: (scope_o[r["scope"]], lo[r["level"]], r.get("subset") or "", r["year"], r["rank"] if r["rank"] else 99,
                                po.get(r["organism"], 999), r["organism"]))
        log.sort(key=lambda r: (r["dataset"], r["key"], str(r["dropped_reportYear"])))
        return res, iso, log


def summarize(res, iso, mapper) -> dict:
    def years(rows):
        ys = sorted({r["year"] for r in rows})
        return ys
    prec = Counter(r["precision"] for r in res)
    by_src = defaultdict(Counter)
    for r in res:
        kind = "mdro_trend" if r["phenotype"] else ("antibiogram" if r["precision"] == "table" and r["susceptible_pct"] is not None else "pathogen_resistance")
        by_src[kind][r["year"]] += 1
    return {
        "resistance": {
            "rows": len(res), "dataYears": years(res), "reportYears": sorted({r["reportYear"] for r in res if r["reportYear"]}),
            "precisionSummary": {k: prec.get(k, 0) for k in ("table", "text", "chart_estimate")},
            "byKind": {k: {str(y): n for y, n in sorted(c.items())} for k, c in sorted(by_src.items())},
            "phenotypes": sorted({r["phenotype"] for r in res if r["phenotype"]}),
        },
        "isolates": {
            "rows": len(iso), "dataYears": years(iso), "reportYears": sorted({r["reportYear"] for r in iso if r["reportYear"]}),
            "precisionSummary": dict(sorted(Counter(r["precision"] for r in iso).items())),
        },
        "inputs": mapper.files_used,
        "skippedRows": dict(sorted(mapper.skipped.items())),
        "autoCodes": {"organisms": sorted(mapper.v.auto_organisms), "antibiotics": sorted(mapper.v.auto_antibiotics)},
    }


def write_csv(path: Path, cols, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(cols)
        for r in rows:
            w.writerow([fmt(r.get(c)) for c in cols])
    if path.exists() and path.read_bytes() == tmp.read_bytes():
        tmp.unlink()
    else:
        tmp.replace(path)


def update_provenance(summary: dict, out_dir: Path):
    path = out_dir / "_provenance.json"
    prov = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    prov.setdefault("_comment", "Per-dataset ingestion status written by scripts/ingest/map_*.py and read by scripts/build_data.py. "
                    "A dataset is published with provisional=false only when status == 'ingested'.")
    ds = prov.setdefault("datasets", {})
    pdfs = sorted(p.name for p in RAW.glob("*.pdf")) if RAW.exists() else []
    for name in ("resistance", "isolates"):
        s = summary[name]
        ds[name] = {"status": "ingested" if s["rows"] > 0 else "pending", "mapper": "scripts/ingest/map_amr.py",
                    "pdfs": pdfs, **s}
    ds["resistance"]["inputs"] = summary["inputs"]
    ds["resistance"]["skippedRows"] = summary["skippedRows"]
    ds["resistance"]["autoCodes"] = summary["autoCodes"]
    new = json.dumps(prov, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != new:
        path.write_text(new, encoding="utf-8")


def run(transcribed: Path = TRANSCRIBED, out_dir: Path = CURATED, quiet=False) -> dict:
    warnings: list[str] = []

    def warn(m):
        warnings.append(m)
        if not quiet:
            print(f"[map_amr] WARN {m}", file=sys.stderr)

    m = Mapper(transcribed, warn)
    m.run()
    res, iso, log = m.finalize()
    write_csv(out_dir / "resistance.csv", RES_COLS, res)
    write_csv(out_dir / "isolates.csv", ISO_COLS, iso)
    write_csv(out_dir / "_dedup_log.csv", DEDUP_COLS, log)
    summary = summarize(res, iso, m)
    summary["warnings"] = len(warnings)
    summary["dedupDropped"] = len(log)
    update_provenance(summary, out_dir)
    if not quiet:
        p = summary["resistance"]["precisionSummary"]
        print(f"[map_amr] resistance rows={len(res)} (table={p['table']} text={p['text']} chart_estimate={p['chart_estimate']}) "
              f"isolates rows={len(iso)} dedup-dropped={len(log)} warnings={len(warnings)}")
    return summary


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transcribed", type=Path, default=TRANSCRIBED)
    ap.add_argument("--out", type=Path, default=CURATED)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args(argv)
    s = run(a.transcribed.resolve(), a.out.resolve(), a.quiet)
    return 0 if s["resistance"]["rows"] or s["isolates"]["rows"] else 1


if __name__ == "__main__":
    sys.exit(main())
