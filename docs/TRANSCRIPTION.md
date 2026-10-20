# PDF → CSV transcription contract (source PDFs live in `raw/`)

The three PDFs in `raw/` are the Taiwan CDC **臺灣抗生素抗藥性監視年報** (Antimicrobial Resistance Surveillance Annual Report, Taiwan) for
report years 2022 (data 2017–2022, ROC 106–111), 2023 (data 2018–2023, ROC 107–112) and 2024 (data 2019–2024, ROC 108–113).
Source system: THAS AR module (台灣醫院感染管制與抗藥性監測管理系統 抗生素抗藥性管理通報模組). ROC year → CE year = ROC + 1911.

Text layer: `pdftotext -layout` dumps (one `\f` per PDF page) and 150-dpi PNG renders of every page exist in the scratchpad
(`/tmp/claude-0/-home-user-tw-amr-dashboard/fbab6fb9-557b-5809-8623-3dd640c28c67/scratchpad/pdf/`):
`report1.txt`+`pages2022/p-NNN.png` (2022), `report2.txt`+`pages2023/` (2023), `report3.txt`+`pages2024/` (2024). PNG NNN = PDF page index (1-based), NOT the printed page number.
Find a figure's PDF page by splitting the txt on `\f` and searching the caption. Numbers inside figures are raster → transcribe visually with the Read tool.

Output: UTF-8 CSV files under `data/source/transcribed/<report_year>/` with EXACT headers below. One row per data point. Numbers as plain digits (no %, no commas).

## antibiogram.csv  (圖 3-1-x 敏感性圖譜 tables: % susceptible + isolates tested)
`report_year,data_year,level,pathogen,antibiotic_abbr,antibiotic,antibiotic_class,susceptible_pct,isolates,pdf_page,figure`
- level: `all` (全國) | `medical_center` (醫學中心) | `regional` (區域醫院) | `district` (地區醫院)
- pathogen: as printed in Latin (e.g. `Enterococcus faecium`, `Staphylococcus aureus`, `Escherichia coli`, `Acinetobacter baumannii`, `Group A Streptococci`, `Non-typhoidal Salmonella`, `Shigella spp.`, `Clostridioides difficile` …)
- antibiotic_abbr: the column code as printed (OX, P-G, P-V, AM, AMC, E, TE, MI, CC, RA, SXT, C, FUR, CTX, CRO, FEP, GM, HLG, CIP, LVX, MXF, IPM, MEM, ETP, TGC, VA, SYN, LZD, DAP, F/M, TZP, SAM, CAZ, CFP, AN, DOR, CS, AZM, …); antibiotic = full generic name; antibiotic_class = the group header as printed (Penicillins, Macrolides, Tetracyclines, Miscellaneous (I), 2nd GCs, 3rd GCs, 4th GCs, Aminoglycosides, Fluoroquinolones, Carbapenems, Miscellaneous (II), …)
- Empty cells in the source = no row. If % present but isolates missing, leave isolates empty.

## pathogen_resistance.csv  (圖 3-2-x bar charts: % resistant for key pathogens, by setting and specimen)
`report_year,data_year,pathogen,antibiotic,infection_setting,specimen,resistant_pct,ci_low,ci_high,read_method,pdf_page,figure`
- infection_setting: `all` (CO+HO 社區與醫療相關感染) | `co` (社區相關感染) | `ho` (醫療相關感染)
- specimen: `all` (全部檢體) | `blood` (血液) | `urine` (尿液) | `sputum` (痰液) | `pus` (膿/傷口) | `stool` (糞便) | `csf` | `genital` …
- read_method: `text` when the exact number is stated in the narrative/caption (preferred), `bar_estimate` when read off the bar/axis (round to nearest 0.5; ci_low/ci_high from error bars if drawn, else empty)

## mdro_trends.csv  (肆 多重抗藥菌 trend line charts 圖 4-x-y-2: % resistant by hospital level per year)
`report_year,phenotype,infection_setting,level,data_year,resistant_pct,read_method,pdf_page,figure`
- phenotype: `CRAB` | `CRE` | `CR-ECO` | `CRKP` | `CRPA` | `MRSA` | `VRE` | `VR-EFA` | `VR-EFM` (and any others present, e.g. `CR-ENT`, `3GC-R-ECO`)
- level: `national` (全國) | `medical_center` | `regional` | `district`
- data_year: CE year. read_method as above (`text` for values stated in the narrative, e.g. "全國 CRAB 抗藥性百分比由 108 年之 55.1% 上升至 113 年之 58.4%").

## mdro_counts.csv  (圖 4-x-y-1 stacked bars: isolate counts by level × CO/HO per year)
`report_year,organism,infection_setting,level,data_year,isolates,read_method,pdf_page,figure`
- infection_setting here is `co` | `ho` | `all` (use `all` when the chart is not split); organism as printed (e.g. `Acinetobacter baumannii`, `Enterobacterales`, `Enterococcus spp.`).

## isolate_counts.csv  (貳 tables 表 2-x: isolate counts & rank by organism, overall / specimen / CO-HO — from the TEXT layer)
`report_year,scope,organism,data_year,rank,isolates,pdf_page,table`
- scope: `all` | `blood` | `urine` | `sputum` | `pus` | `stool` | `co` | `ho`

## notes.md (per report year)
Free text: methodology differences between editions, breakpoints (CLSI version), participating hospital counts per year, first-isolate rule, anything that affects comparability, plus a per-file row count and your confidence.

Rules: never invent values; if a bar is unreadable write the row with resistant_pct empty and read_method `unreadable`. Keep ROC→CE conversion exact. Transcribe every pathogen/antibiotic present even if not in the examples.
