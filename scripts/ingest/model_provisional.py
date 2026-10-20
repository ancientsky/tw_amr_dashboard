#!/usr/bin/env python3
"""Generate the PROVISIONAL curated tables for datasets whose source PDFs were NOT supplied:

  data/curated/antibiotic_use.csv   (臺灣抗生素使用量監視年報 — not supplied)
  data/curated/hai.csv              (醫療照護相關感染監視年報 / TNIS — not supplied)
  data/curated/hai_pathogens.csv    (TNIS — not supplied)

These are deterministic, internally consistent *model estimates* shaped on published Taiwan CDC / THAS / TNIS
trends (levels, ICU types, COVID-era dip/rebound). They are NOT official figures; every row carries
origin=model and build_data.py publishes the envelopes with provisional=true. When a real report is mapped
(scripts/ingest/map_amu.py / map_hai.py) the mapper overwrites the CSV with origin=pdf rows and sets
data/curated/_provenance.json -> status 'ingested'. This script refuses to overwrite an ingested dataset
unless --force is given.

Usage: python3 scripts/ingest/model_provisional.py [--only amu|hai|hai_pathogens] [--force]
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "data" / "curated"
YEARS = list(range(2017, 2025))
LEVELS = ["medical_center", "regional", "district"]


def gauss(*key, sd=1.0):
    h = hashlib.sha256("|".join(map(str, key)).encode()).digest()
    u1 = (int.from_bytes(h[:8], "big") + 1) / 2 ** 64
    u2 = int.from_bytes(h[8:16], "big") / 2 ** 64
    return sd * math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


def lerp(a, b, y, y0=2017, y1=2024):
    t = (y - y0) / (y1 - y0)
    return a + (b - a) * t


def write(path: Path, cols, rows):
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(cols)
        for r in rows:
            w.writerow([r[c] for c in cols])
    print(f"[model] wrote {len(rows)} rows -> {path.relative_to(ROOT)}")


# --------------------------------------------------------------------------- AMU
# class: (atc, aware, (MC17, MC24), (RG17, RG24), (DS17, DS24), covid-profile)   values = DID (DDD/1000 patient-days)
AMU = {
    "PEN":      ("J01CA/J01CE/J01CF", "Access", (28, 24), (30, 26), (36, 32), "resp"),
    "AMC_SAM":  ("J01CR01/J01CR02", "Access", (89, 98), (99, 108), (108, 115), "resp"),
    "PIP_TAZ":  ("J01CR05", "Watch", (42, 56), (34, 46), (19, 28), "severe"),
    "CEPH1":    ("J01DB", "Access", (82, 80), (90, 88), (95, 92), "surg"),
    "CEPH2":    ("J01DC", "Watch", (43, 40), (48, 44), (53, 48), "surg"),
    "CEPH3":    ("J01DD", "Watch", (120, 125), (127, 132), (122, 128), "severe"),
    "CEPH4":    ("J01DE", "Watch", (30, 36), (24, 30), (12, 16), "severe"),
    "BL_NOVEL": ("J01DD52/J01DI54/J01DI02", "Reserve", (0.3, 6), (0.1, 3), (0.0, 0.5), "novel"),
    "CARB":     ("J01DH", "Watch", (78, 92), (57, 68), (24, 30), "severe"),
    "FQ":       ("J01MA", "Watch", (86, 80), (90, 86), (84, 80), "resp"),
    "GLYCO":    ("J01XA", "Watch", (54, 58), (40, 45), (20, 24), "severe"),
    "AMINOG":   ("J01GB", "Access", (20, 16), (23, 18), (26, 20), "none"),
    "MACRO":    ("J01FA", "Watch", (17, 14), (19, 16), (23, 19), "resp"),
    "LINCO":    ("J01FF", "Access", (17, 16), (19, 18), (21, 20), "surg"),
    "TETRA":    ("J01AA (excl. J01AA12)", "Access", (12, 16), (10, 14), (9, 11), "none"),
    "GLYCYL":   ("J01AA12", "Reserve", (10, 7), (7.5, 6), (3, 2.5), "severe"),
    "POLY":     ("J01XB", "Reserve", (6, 11), (4.5, 8), (1.2, 2.5), "severe"),
    "OXAZ":     ("J01XX08/J01XX11", "Reserve", (6, 9), (4, 6), (1.3, 2), "severe"),
    "LIPO":     ("J01XX09", "Reserve", (2.5, 6), (1.5, 4), (0.4, 1.2), "severe"),
    "SXT":      ("J01EE", "Access", (15, 17), (13.5, 15), (12, 13), "none"),
    "NITRO":    ("J01XD", "Access", (25, 24), (23, 22), (21, 20), "surg"),
    "OTHER":    ("J01 (other)", "Unclassified", (11, 12), (10, 11), (9.5, 10), "none"),
}
COVID = {  # multiplicative profile by year (Taiwan: 2020 border control/masking, 2021 May–Jul level-3 alert, 2022 Omicron wave)
    "resp":   {2020: 0.90, 2021: 0.85, 2022: 0.95, 2023: 1.05},
    "surg":   {2020: 0.97, 2021: 0.90, 2022: 0.95},
    "severe": {2020: 1.00, 2021: 1.04, 2022: 1.08, 2023: 1.03},
    "none": {}, "novel": {},
}
PD_WEIGHT = {"medical_center": 0.37, "regional": 0.45, "district": 0.18}


def gen_amu():
    rows = []
    for y in YEARS:
        level_vals = {}
        for li, lv in enumerate(LEVELS):
            vals = {}
            for cls, (atc, aware, *lvls, prof) in AMU.items():
                a, b = lvls[li]
                if prof == "novel":   # ceftazidime-avibactam / ceftolozane-tazobactam uptake from ~2018
                    t = max(0.0, (y - 2017) / 7)
                    v = a + (b - a) * t ** 1.3
                else:
                    v = lerp(a, b, y) * COVID[prof].get(y, 1.0)
                v *= 1 + gauss("amu", cls, lv, y, sd=0.015)
                vals[cls] = max(v, 0.0)
            level_vals[lv] = vals
        level_vals["all"] = {c: sum(level_vals[lv][c] * PD_WEIGHT[lv] for lv in LEVELS) for c in AMU}
        for lv in ["all", *LEVELS]:
            rounded = {c: round(level_vals[lv][c], 1) for c in AMU}
            for cls, (atc, aware, *_r) in AMU.items():
                rows.append({"year": y, "level": lv, "setting": "inpatient", "atc": atc, "className": cls, "aware": aware,
                             "metric": "DID", "value": rounded[cls], "origin": "model"})
            rows.append({"year": y, "level": lv, "setting": "inpatient", "atc": "J01", "className": "TOTAL",
                         "aware": "Unclassified", "metric": "DID", "value": round(sum(rounded.values()), 1), "origin": "model"})
    write(CURATED / "antibiotic_use.csv", ["year", "level", "setting", "atc", "className", "aware", "metric", "value", "origin"], rows)


# --------------------------------------------------------------------------- HAI
ICU_TYPES = {  # PD share by level, rate multipliers (clabsi, cauti, vap), utilisation (cl, uc, vent)
    "medical":   {"share": {"medical_center": .28, "regional": .33, "district": .20}, "rate": (1.0, 1.0, 1.0), "util": (.62, .66, .52)},
    "surgical":  {"share": {"medical_center": .25, "regional": .25}, "rate": (.75, .9, 1.1), "util": (.65, .70, .45)},
    "mixed":     {"share": {"medical_center": .12, "regional": .25, "district": .80}, "rate": (.9, .95, 1.0), "util": (.55, .60, .45)},
    "cardiac":   {"share": {"medical_center": .12, "regional": .07}, "rate": (.55, .6, .8), "util": (.75, .70, .40)},
    "neuro":     {"share": {"medical_center": .08}, "rate": (.7, 1.1, 1.2), "util": (.50, .60, .45)},
    "pediatric": {"share": {"medical_center": .05, "regional": .04}, "rate": (1.0, .5, .7), "util": (.45, .20, .40)},
    "neonatal":  {"share": {"medical_center": .07, "regional": .06}, "rate": (1.6, .2, .6), "util": (.30, .03, .25)},
    "burn":      {"share": {"medical_center": .03}, "rate": (2.0, 1.5, 1.8), "util": (.70, .65, .35)},
}
LEVEL_PD = {"medical_center": 1_000_000, "regional": 1_000_000, "district": 250_000}  # ICU patient-days / year
LEVEL_RATE = {"medical_center": 1.0, "regional": 0.82, "district": 0.76}
LEVEL_UTIL = {"medical_center": 1.0, "regional": 0.92, "district": 0.86}
PUBLISH_TYPES = {"medical_center": list(ICU_TYPES), "regional": ["medical", "surgical", "mixed", "cardiac", "pediatric", "neonatal"],
                 "district": []}


def hai_trend(y):
    """Relative device-associated infection rate vs 2017 (bundle-driven decline, COVID-era rebound 2021–22)."""
    base = 0.93 ** (y - 2017) if y <= 2019 else 0.93 ** 2 * 0.985 ** (y - 2019)
    return base * {2020: 1.00, 2021: 1.07, 2022: 1.13, 2023: 1.04}.get(y, 1.0)


def gen_hai():
    cells = {}  # (y, level, type) -> counts
    for y in YEARS:
        pd_year = {2020: 0.98, 2021: 0.96, 2022: 0.97}.get(y, 1.0)
        for lv in LEVELS:
            shares = {t: d["share"][lv] for t, d in ICU_TYPES.items() if lv in d["share"]}
            tot = sum(shares.values())
            for t, sh in shares.items():
                d = ICU_TYPES[t]
                pd = LEVEL_PD[lv] * pd_year * sh / tot * (1 + 0.01 * (y - 2017))
                du = [min(0.95, u * LEVEL_UTIL[lv] * (1 - 0.008 * (y - 2017)) * (1 + gauss("util", t, lv, y, k, sd=.015)))
                      for k, u in enumerate(d["util"])]
                du[1] *= 1 - 0.012 * (y - 2017)  # catheter-removal bundle lowers urinary catheter use
                tr = hai_trend(y)
                rates = [r0 * mult * LEVEL_RATE[lv] * tr * (1 + gauss("rate", t, lv, y, k, sd=.05))
                         for k, (r0, mult) in enumerate(zip((5.6, 3.9, 1.7), d["rate"]))]
                cl, uc, vent = (pd * u for u in du)
                clabsi, cauti, vap = cl * rates[0] / 1000, uc * rates[1] / 1000, vent * rates[2] / 1000
                bsi_other = pd * 0.45 * tr / 1000
                uti_other = pd * 0.15 * tr / 1000
                pneu_other = pd * 0.32 * tr / 1000
                other = pd * 0.55 * tr / 1000
                cells[(y, lv, t)] = dict(pd=pd, cl=cl, uc=uc, vent=vent, clabsi=clabsi, cauti=cauti, vap=vap,
                                         bsi=clabsi + bsi_other, uti=cauti + uti_other, pneu=vap + pneu_other,
                                         hai=clabsi + bsi_other + cauti + uti_other + vap + pneu_other + other)

    def agg(y, lv, t):
        keys = [k for k in cells if k[0] == y and (lv == "all" or k[1] == lv) and (t == "all" or k[2] == t)]
        out = {}
        for k in keys:
            for m, v in cells[k].items():
                out[m] = out.get(m, 0) + v
        return out

    metric_unit = [("hai_density", "per_1000_patient_days"), ("bsi_density", "per_1000_patient_days"),
                   ("uti_density", "per_1000_patient_days"), ("pneu_density", "per_1000_patient_days"),
                   ("clabsi", "per_1000_device_days"), ("cauti", "per_1000_device_days"), ("vap", "per_1000_device_days"),
                   ("central_line_util", "ratio"), ("urinary_cath_util", "ratio"), ("ventilator_util", "ratio")]
    rows = []
    combos = [("all", "all"), *[("all", t) for t in ICU_TYPES]]
    for lv in LEVELS:
        combos += [(lv, "all")] + [(lv, t) for t in PUBLISH_TYPES[lv]]
    for y in YEARS:
        for lv, t in combos:
            c = agg(y, lv, t)
            vals = {"hai_density": c["hai"] / c["pd"] * 1000, "bsi_density": c["bsi"] / c["pd"] * 1000,
                    "uti_density": c["uti"] / c["pd"] * 1000, "pneu_density": c["pneu"] / c["pd"] * 1000,
                    "clabsi": c["clabsi"] / c["cl"] * 1000, "cauti": c["cauti"] / c["uc"] * 1000, "vap": c["vap"] / c["vent"] * 1000,
                    "central_line_util": c["cl"] / c["pd"], "urinary_cath_util": c["uc"] / c["pd"], "ventilator_util": c["vent"] / c["pd"]}
            for m, unit in metric_unit:
                rows.append({"year": y, "level": lv, "icu_type": t, "metric": m,
                             "value": round(vals[m], 3 if unit == "ratio" else 2), "unit": unit, "origin": "model"})
    write(CURATED / "hai.csv", ["year", "level", "icu_type", "metric", "value", "unit", "origin"], rows)
    return cells


# --------------------------------------------------------------------------- HAI pathogens
# base share (% of isolates, 2017) -> 2024 share
HP = {
    "bsi":  {"KPN": (13, 16), "EFM": (9, 13.5), "ECO": (9, 10), "SAU": (8, 7), "CNS": (8, 7), "CAL": (7, 6), "CSP": (5, 7),
             "ABA": (8, 4.5), "PAE": (7, 6), "EFA": (4, 4), "ECL": (4, 4.5), "SMA": (3, 3.5), "SMR": (2, 2)},
    "uti":  {"ECO": (25, 27), "KPN": (12, 15), "PAE": (13, 12), "EFM": (8, 11), "CAL": (9, 6), "CSP": (5.5, 4), "EFA": (7, 7),
             "PMI": (4, 4), "ABA": (3.5, 2), "ECL": (3, 3), "SAU": (1.5, 1.5)},
    "pneu": {"PAE": (18, 16), "KPN": (15, 18), "ABA": (17, 10.5), "SAU": (12, 12), "SMA": (6, 9), "ECO": (5, 6), "ECL": (5, 6),
             "SMR": (3, 4), "CAL": (2, 1.5), "EFM": (1, 1.2)},
    "other": {"SAU": (15, 14), "ECO": (12, 12), "KPN": (10, 11), "PAE": (10, 10), "EFA": (8, 8), "EFM": (7, 9), "ABA": (6, 4),
              "ECL": (6, 6), "CAL": (5, 5), "CNS": (4, 4)},
}
LEVEL_SHIFT = {"medical_center": {"EFM": 1.08, "ABA": 0.92}, "regional": {"ABA": 1.1, "KPN": 1.04, "EFM": 0.92}, "district": {"ECO": 1.1}}


def gen_hai_pathogens(cells):
    rows = []
    for y in YEARS:
        for lv in ["all", "medical_center", "regional"]:
            levels = LEVELS if lv == "all" else [lv]
            site_counts = {"bsi": 0.0, "uti": 0.0, "pneu": 0.0, "other": 0.0}
            for (yy, l2, t), c in cells.items():
                if yy == y and l2 in levels:
                    site_counts["bsi"] += c["bsi"]; site_counts["uti"] += c["uti"]; site_counts["pneu"] += c["pneu"]
                    site_counts["other"] += c["hai"] - c["bsi"] - c["uti"] - c["pneu"]
            shares = {}
            for site, base in HP.items():
                s = {}
                for org, (a, b) in base.items():
                    mult = 1.0
                    if lv != "all":
                        mult = LEVEL_SHIFT.get(lv, {}).get(org, 1.0)
                    s[org] = max(0.1, lerp(a, b, y) * mult * (1 + gauss("hp", site, org, lv, y, sd=0.03)))
                s["OTHER"] = max(5.0, 100 - sum(s.values()))
                tot = sum(s.values())
                shares[site] = {k: v / tot * 100 for k, v in s.items()}
            total = sum(site_counts.values())
            allsite = {}
            for site, sh in shares.items():
                for org, v in sh.items():
                    allsite[org] = allsite.get(org, 0) + v * site_counts[site] / total
            for site, sh in [("all", allsite), ("bsi", shares["bsi"]), ("uti", shares["uti"]), ("pneu", shares["pneu"])]:
                ranked = sorted(((v, k) for k, v in sh.items() if k != "OTHER"), key=lambda x: (-x[0], x[1]))[:10]
                for rank, (v, org) in enumerate(ranked, 1):
                    rows.append({"year": y, "level": lv, "site": site, "rank": rank, "pathogen": org, "pct": round(v, 1), "origin": "model"})
    write(CURATED / "hai_pathogens.csv", ["year", "level", "site", "rank", "pathogen", "pct", "origin"], rows)


def ingested(name: str) -> bool:
    p = CURATED / "_provenance.json"
    if not p.exists():
        return False
    return json.loads(p.read_text(encoding="utf-8")).get("datasets", {}).get(name, {}).get("status") == "ingested"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", choices=["amu", "hai", "hai_pathogens"])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    want = {a.only} if a.only else {"amu", "hai", "hai_pathogens"}
    ds = {"amu": "antibiotic_use", "hai": "hai", "hai_pathogens": "hai_pathogens"}
    for k in list(want):
        if ingested(ds[k]) and not a.force:
            print(f"[model] {ds[k]} is marked ingested in _provenance.json - not overwriting (use --force)")
            want.discard(k)
    if "amu" in want:
        gen_amu()
    if want & {"hai", "hai_pathogens"}:
        cells = gen_hai() if "hai" in want else None
        if "hai_pathogens" in want:
            if cells is None:
                import io, contextlib
                with contextlib.redirect_stdout(io.StringIO()):
                    cells = gen_hai()
            gen_hai_pathogens(cells)
    return 0


if __name__ == "__main__":
    sys.exit(main())
