#!/usr/bin/env bash
# Regenerate everything that can be regenerated automatically from raw/ + data/source/transcribed/.
#   1. text-layer isolate tables (表 2-x) of every THAS AMR report in raw/  -> data/source/transcribed/<year>/isolate_counts.csv
#   2. (optional, EXTRACT=1) generic pdfplumber dump of every PDF            -> data/source/extracted/<pdf>/
#   3. AMU / HAI skeleton mappers, only if such a PDF exists in raw/ (failure keeps the provisional data)
#   4. scripts/build_data.py (runs map_amr.py, validates, writes public/data + public/api)
# Figures with raster numbers (charts) are NOT handled here - see docs/TRANSCRIPTION.md.
set -uo pipefail
cd "$(dirname "$0")/../.."
PY=${PYTHON:-python3}
shopt -s nullglob

amr=(raw/*抗藥性*.pdf)
if ((${#amr[@]})); then
  $PY scripts/ingest/parse_isolate_tables.py "${amr[@]}" || echo "::warning::isolate-table parser reported problems"
fi
if [[ "${EXTRACT:-0}" == "1" ]]; then
  pdfs=(raw/*.pdf)
  ((${#pdfs[@]})) && $PY scripts/ingest/extract_tables.py "${pdfs[@]}"
fi
amu=(raw/*使用量*.pdf)
if ((${#amu[@]})); then
  $PY scripts/ingest/extract_tables.py "${amu[@]}" && $PY scripts/ingest/map_amu.py || echo "::warning::AMU mapper failed - provisional data kept"
fi
hai=(raw/*感染*.pdf)
if ((${#hai[@]})); then
  $PY scripts/ingest/extract_tables.py "${hai[@]}" && $PY scripts/ingest/map_hai.py || echo "::warning::HAI mapper failed - provisional data kept"
fi
$PY scripts/build_data.py
