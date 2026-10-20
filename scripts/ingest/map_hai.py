#!/usr/bin/env python3
"""SKELETON mapper: 醫療照護相關感染監視年報 (TNIS; NOT yet supplied) -> data/curated/hai.csv (+ hai_pathogens.csv)

Expected TNIS layouts (verify against the real report and adjust the TODO hooks):
  * ICU HAI density table: rows = hospital level × ICU type (醫學中心/區域醫院 × 內科/外科/內外科/心臟/兒科/新生兒/燒燙傷…),
    columns = ROC years, values = 感染密度 ‰ (per 1,000 patient-days).
  * device-associated infection tables: 中心導管相關血流感染 (CLABSI), 導尿管相關泌尿道感染 (CAUTI),
    呼吸器相關肺炎 (VAP) per 1,000 device-days, and 使用率 (device utilisation ratio).
  * pathogen ranking tables by infection site (血流/泌尿道/肺炎): rank, organism, %.
On success: curated CSVs rewritten with origin=pdf, _provenance.json status='ingested'; on failure status='failed'.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _mapper_common import load_tables, match_header, roc_to_ce, set_status, to_num, write_curated  # noqa: E402

METRIC_SYNONYMS = {
    "clabsi": ["中心導管相關血流感染", "clabsi"], "cauti": ["導尿管相關泌尿道感染", "cauti"], "vap": ["呼吸器相關肺炎", "vap"],
    "central_line_util": ["中心導管使用率"], "urinary_cath_util": ["導尿管使用率"], "ventilator_util": ["呼吸器使用率"],
    "bsi_density": ["血流感染密度"], "uti_density": ["泌尿道感染密度"], "pneu_density": ["肺炎感染密度"], "hai_density": ["感染密度", "hai density"],
}
UNIT = {"clabsi": "per_1000_device_days", "cauti": "per_1000_device_days", "vap": "per_1000_device_days",
        "central_line_util": "ratio", "urinary_cath_util": "ratio", "ventilator_util": "ratio"}
ICU_SYNONYMS = {"medical": ["內科"], "surgical": ["外科"], "mixed": ["內外科", "綜合"], "cardiac": ["心臟", "冠狀"], "neuro": ["神經"],
                "pediatric": ["兒科", "小兒"], "neonatal": ["新生兒"], "burn": ["燒燙傷"], "all": ["全部", "合計", "總計"]}
LEVEL_SYNONYMS = {"medical_center": ["醫學中心"], "regional": ["區域醫院"], "district": ["地區醫院"], "all": ["全國"]}


def map_tables(stem_glob: str):
    rows = []
    for d, page, path, table in load_tables(stem_glob):
        caption = (d / "index.json").read_text(encoding="utf-8") if (d / "index.json").exists() else ""
        metric = None
        # TODO: take the metric from this page's caption in index.json instead of the whole file
        for row in table[:2]:
            metric = metric or match_header(" ".join(row), METRIC_SYNONYMS)
        years = [roc_to_ce(h) for h in table[0]] if table else []
        if not metric or not any(years):
            continue
        level = "all"
        for row in table[1:]:
            level = match_header(row[0], LEVEL_SYNONYMS) or level
            icu = match_header(row[0], ICU_SYNONYMS) or (match_header(row[1], ICU_SYNONYMS) if len(row) > 1 else None)
            if not icu:
                continue
            for j, cell in enumerate(row):
                val = to_num(cell)
                if val is None or j >= len(years) or not years[j]:
                    continue
                if metric.endswith("_util") and val > 1.5:
                    val = val / 100  # utilisation printed as %
                rows.append({"year": years[j], "level": level, "icu_type": icu, "metric": metric, "value": val,
                             "unit": UNIT.get(metric, "per_1000_patient_days"), "origin": "pdf"})
    return rows


def main():
    stem_glob = sys.argv[1] if len(sys.argv) > 1 else "*感染*"
    rows = map_tables(stem_glob)
    # TODO: de-duplicate, map hai_pathogens ranking tables (site × rank × organism × %) via vocab.Vocab().organism()
    if len(rows) < 50:
        set_status("hai", "failed", mapper="scripts/ingest/map_hai.py", reason=f"only {len(rows)} values matched; adjust heuristics")
        print(f"[map_hai] FAILED: {len(rows)} values matched - provisional data kept", file=sys.stderr)
        return 1
    write_curated("hai", ["year", "level", "icu_type", "metric", "value", "unit", "origin"], rows)
    set_status("hai", "ingested", mapper="scripts/ingest/map_hai.py", rows=len(rows))
    print(f"[map_hai] ingested {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
