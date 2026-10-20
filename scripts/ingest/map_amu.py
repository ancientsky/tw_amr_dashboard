#!/usr/bin/env python3
"""SKELETON mapper: 臺灣抗生素使用量監視年報 (antibiotic-use report; NOT yet supplied) -> data/curated/antibiotic_use.csv

Expected input: raw/<...抗生素使用量...>.pdf, extracted first with
  python3 scripts/ingest/extract_tables.py raw/<amu>.pdf
Expected layouts (THAS AMU module; verify against the real report and adjust the TODO hooks):
  * "DID by antimicrobial class" tables: rows = ATC class (e.g. 'Carbapenems (J01DH)'), columns = ROC years
    or hospital levels (醫學中心/區域醫院/地區醫院), values = DDD per 1,000 patient-days.
  * a total row 'J01 合計 / Total'.
On success the curated CSV is rewritten with origin=pdf rows and _provenance.json status='ingested'; on failure
the provisional CSV is left untouched and status='failed' is recorded (build stays provisional).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _mapper_common import load_tables, match_header, roc_to_ce, set_status, to_num, write_curated  # noqa: E402

# class code -> synonyms that may appear in the row label (zh/en/ATC)
CLASS_SYNONYMS = {
    "PEN": ["J01CA", "J01CE", "J01CF", "penicillins with extended", "青黴素"], "AMC_SAM": ["J01CR01", "J01CR02", "amoxicillin and", "ampicillin and"],
    "PIP_TAZ": ["J01CR05", "piperacillin"], "CEPH1": ["J01DB", "first-generation", "第一代"], "CEPH2": ["J01DC", "second-generation", "第二代"],
    "CEPH3": ["J01DD", "third-generation", "第三代"], "CEPH4": ["J01DE", "fourth-generation", "第四代"],
    "BL_NOVEL": ["J01DD52", "J01DI54", "ceftazidime-avibactam", "ceftolozane"], "CARB": ["J01DH", "carbapenem", "碳青黴烯"],
    "FQ": ["J01MA", "fluoroquinolone", "氟喹諾酮"], "GLYCO": ["J01XA", "glycopeptide", "醣肽"], "AMINOG": ["J01GB", "aminoglycoside", "胺基醣苷"],
    "MACRO": ["J01FA", "macrolide", "巨環"], "LINCO": ["J01FF", "lincosamide", "clindamycin"], "TETRA": ["J01AA", "tetracycline", "四環"],
    "GLYCYL": ["J01AA12", "tigecycline"], "POLY": ["J01XB", "polymyxin", "colistin", "多黏菌素"], "OXAZ": ["J01XX08", "linezolid", "oxazolidinone"],
    "LIPO": ["J01XX09", "daptomycin"], "SXT": ["J01EE", "sulfamethoxazole"], "NITRO": ["J01XD", "metronidazole"], "TOTAL": ["J01合計", "total", "合計", "總計"],
}
LEVEL_SYNONYMS = {"medical_center": ["醫學中心", "medical center"], "regional": ["區域醫院", "regional"], "district": ["地區醫院", "district"],
                  "all": ["全國", "national", "all"]}
AWARE = {"PEN": "Access", "AMC_SAM": "Access", "PIP_TAZ": "Watch", "CEPH1": "Access", "CEPH2": "Watch", "CEPH3": "Watch", "CEPH4": "Watch",
         "BL_NOVEL": "Reserve", "CARB": "Watch", "FQ": "Watch", "GLYCO": "Watch", "AMINOG": "Access", "MACRO": "Watch", "LINCO": "Access",
         "TETRA": "Access", "GLYCYL": "Reserve", "POLY": "Reserve", "OXAZ": "Reserve", "LIPO": "Reserve", "SXT": "Access", "NITRO": "Access",
         "OTHER": "Unclassified", "TOTAL": "Unclassified"}


def map_tables(stem_glob: str):
    rows = []
    for _d, page, path, table in load_tables(stem_glob):
        if len(table) < 3:
            continue
        header = table[0]
        years = [roc_to_ce(h) for h in header]
        levels = [match_header(h, LEVEL_SYNONYMS) for h in header]
        if not any(years) and not any(levels):
            continue
        for row in table[1:]:
            cls = match_header(row[0], {k: v for k, v in sorted(CLASS_SYNONYMS.items(), key=lambda kv: -max(map(len, kv[1])))})
            if not cls:
                continue
            for j, cell in enumerate(row[1:], 1):
                val = to_num(cell)
                if val is None:
                    continue
                year = years[j] if j < len(years) and years[j] else None   # TODO: year from caption when columns are levels
                level = levels[j] if j < len(levels) and levels[j] else "all"
                if not year:
                    continue
                rows.append({"year": year, "level": level, "setting": "inpatient", "atc": "", "className": cls, "aware": AWARE[cls],
                             "metric": "DID", "value": round(val, 1), "origin": "pdf", "_ref": f"{path.name}"})
    return rows


def main():
    stem_glob = sys.argv[1] if len(sys.argv) > 1 else "*使用量*"
    rows = map_tables(stem_glob)
    # TODO: fill `atc` from data/curated/dims/amu.json, de-duplicate, compute 'all' level if absent, verify TOTAL = sum(classes)
    if len(rows) < 50:
        set_status("antibiotic_use", "failed", mapper="scripts/ingest/map_amu.py", reason=f"only {len(rows)} values matched; adjust heuristics")
        print(f"[map_amu] FAILED: {len(rows)} values matched - provisional data kept", file=sys.stderr)
        return 1
    for r in rows:
        r.pop("_ref")
    write_curated("antibiotic_use", ["year", "level", "setting", "atc", "className", "aware", "metric", "value", "origin"], rows)
    set_status("antibiotic_use", "ingested", mapper="scripts/ingest/map_amu.py", rows=len(rows))
    print(f"[map_amu] ingested {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
