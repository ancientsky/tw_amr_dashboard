# TW-AMR Watch — data guide

This page covers what is in `public/data/*.json`, where each number comes from, how exact it is, and how to update it.
The binding contract is `docs/ARCHITECTURE.md` §4. Machine-readable schemas live in `data/schema/*.schema.json`
(JSON Schema draft 2020-12), and the build validates against them.

## 1. Provenance at a glance

| Dataset | Status | Source | Exactness |
|---|---|---|---|
| `resistance.json` | **real** (`provisional:false`) | Taiwan CDC 臺灣抗生素抗藥性監視年報, 2022/2023/2024 editions (THAS AR module), files in `raw/` | per-record `precision` |
| `isolates.json` | **real** (`provisional:false`) | same reports: 表 2-x (text layer) and 圖 4-x-y-1 (charts) | per-record `precision` |
| `antibiotic_use.json` | **provisional estimate** | model shaped on published Taiwan CDC AMU trends (report not supplied) | model |
| `hai.json`, `hai_pathogens.json` | **provisional estimate** | model shaped on published TNIS trends (report not supplied) | model |
| `glass.json` | **provisional** | approximate curated values from WHO GLASS 2022 and national systems; **TWN rows computed from the real `resistance.json`** | approximate |
| `links.json`, `glossary.json`, `kb.json` | content (passed through) | content agent (`data/curated/{links,glossary,kb}.json`) | — |

`meta.json → provisionalDatasets` lists the datasets the UI must badge as provisional. Nothing provisional may be presented as official.

## 2. How the real data were produced (vision + text-layer transcription)

The PDFs mix vector text with raster charts, so three methods were used. Each one is recorded per value:

| PDF content | Method | `precision` | Typical error |
|---|---|---|---|
| 表 2-x isolate-count tables (貳) | parsed from the PDF text layer by `scripts/ingest/parse_isolate_tables.py`; every table is checked against its printed 總計 | `table` | exact |
| 圖 3-1-x antibiograms (%S and n, by hospital level) | vector graphics, so numbers come from the text layer (pdfplumber character coordinates), then each page is checked visually. Grey (suppressed, n<20 or not CLSI-recommended) cells are excluded | `table` | exact |
| values quoted in the report narrative or captions (e.g. "全國 CRAB 由 108 年 55.1% 上升至 113 年 58.4%") | read from the text | `text` | exact (as printed, 1 dp) |
| 圖 3-2-x bar charts, 圖 4-x-y line and stacked-bar charts | **read by eye** off the rendered page (150 dpi) by transcription agents, rounded to 0.5 | `chart_estimate` | **≈ ±1–2 percentage points** (counts ±1–2 % of the axis range) |

Transcription CSVs live in `data/source/transcribed/<report_year>/` with the exact headers of `docs/TRANSCRIPTION.md`.
Each folder has `notes*.md` describing method, confidence and source oddities. For example, in the 2024 edition the
B. fragilis medical-centre antibiogram block duplicates the national block, and the 2023 sputum table's rows do not add up
to its printed 總計. Values are transcribed **as printed**, never corrected or invented. A bar that cannot be read gets
`read_method=unreadable` and is skipped.

### Mapping rules (`scripts/ingest/map_amr.py`)
* Organism names → codes via `data/curated/dims/organisms.json` aliases. The 2022 edition's
  "A. calcoaceticus–A. baumannii complex" and the 2023+ "A. baumannii" both map to `ABA`. The 2022 antibiogram row
  "Salmonella spp." is the NTS row, so it maps to `NTS`; in the 表 2-x isolate tables "Salmonella spp." stays `SAL`.
* MDRO count charts: organisms with an "(I+R)" / "[I+R]" suffix are **non-susceptible isolate counts**, and "(S)" / "[S]"
  are susceptible counts. They become isolate records with `subset: "I+R"` or `subset: "S"` and are never added to totals
  or used as denominators. Setting `all` rows come
  from the CO+HO chart; `co`/`ho` rows come from the setting-specific charts. As a QC check, (I+R)/total reproduces the
  independently transcribed MDRO %R (median difference ≈ 0 pts; see `isolates.json → meta.qc`).
* Antibiogram class headers vary by edition ("4rd GCs", "1st GC"). The mapper ignores them and takes the class from
  `dims/antibiotics.json`. Colistin is `CL` (2022) or `CS` (2023+), both mapped to `COL`; `LZD` maps to `LNZ`.
* Antibiotic abbreviations → canonical codes via the report's 附錄 2 table (`dims/antibiotics.json → meta.thas`).
  Note `FUR` (cefuroxime sodium) → `CXM`, while the printed abbreviation `CXM` (cefuroxime axetil) → `CXA`.
* Antibiogram rows: `resistant_pct = 100 − susceptible_pct`. This is the **non-susceptible** share (it includes
  intermediate), and `susceptible_pct` is kept.
* MDRO trend rows (肆) carry `phenotype`. Their `pathogen`/`antibiotic` are the organism and the class-representative code
  (`CRAB`→ABA/MEM, `CRE`→ENB/MEM, `CR-ECO`→ECO/MEM, `CRKP`→KPN/MEM, `CRPA`→PAE/MEM, `MRSA`→SAU/OXA, `VRE`→ENC/VAN,
  `VR-EFA`→EFA/VAN, `VR-EFM`→EFM/VAN). National → `level:'all'`. Their `isolates` is joined from the matching
  organism count (MDRO count chart or 表 2-x).
* **Duplicates across editions** (e.g. MDRO trend year 2020 appears in all three reports): newest `reportYear` wins,
  then precision `table > text > chart_estimate`. Isolate-count tables are taken **whole** from the newest edition per
  (year, scope), so top-N lists are never mixed. Every superseded value is listed in `data/curated/_dedup_log.csv`.
  Editions revise history (e.g. 2018 A. baumannii isolates: 20,827 in the 2022 edition vs 17,608 in the 2023 edition),
  so a trend line can contain points from different editions. `reportYear` lets the UI show this.
* Manual corrections: add rows to `data/curated/resistance_overrides.csv` (same columns). They always win.

## 3. Datasets and fields

Every file is an envelope `{dataset, version, generatedAt, provisional, sources[], notes?, meta?, dims, records[]}`.
`dims` lists only codes that occur in `records`, each with `{code, name:{zh-TW,en,ja}, group?, order?, meta?}`.

### `resistance.json` — `ResistanceRecord`
| field | type | notes |
|---|---|---|
| `year` | int | data year (CE) |
| `pathogen` | code | `dims.pathogens` (see §4) |
| `antibiotic` | code | `dims.antibiotics`; `dims.antibioticClasses` groups them |
| `phenotype` | code? | only on MDRO trend rows; **absent on drug-level rows** |
| `level` | `all \| medical_center \| regional \| district` | |
| `ward` | `all` | THAS AR reports do not split ICU/non-ICU (kept for contract compatibility) |
| `setting` | `all \| co \| ho` | CO+HO / community-onset / hospital-onset |
| `specimen` | `all \| blood \| urine \| sputum \| pus \| stool` (+ `csf`, `genital` if transcribed) | |
| `isolates` | int \| null | isolates tested (antibiogram) or organism count (MDRO rows); null for chart rows without n |
| `resistant_pct` | number 0–100 | see the mapping rules above |
| `susceptible_pct` | number? | antibiogram rows only |
| `ci_low`, `ci_high` | number? | error bars read from 圖 3-2-x, when drawn |
| `precision` | `table \| text \| chart_estimate` | |
| `reportYear` | int? | report edition the value was taken from |

`meta.coverage` holds data and report years and per-kind counts per year. `meta.precisionSummary` counts records by precision.

**Querying tips for the UI.** Trend charts: filter `phenotype === X`, `setting`, `level`. Antibiogram or heat-map:
filter `phenotype === undefined && specimen === 'all' && setting === 'all'` for one `year` and `level`. Specimen and
CO/HO bar charts: `phenotype === undefined && level === 'all'` with `specimen !== 'all' || setting !== 'all'`.

### `isolates.json` — `IsolateRecord`
`{year, organism, scope, level, subset?, rank?, isolates, precision, reportYear}`. `subset: "I+R"` (non-susceptible)
or `"S"` (susceptible) marks the split counts from the MDRO charts (by level × CO/HO). Records without `subset` are totals. `scope` is `all` (all specimens),
`blood|urine|sputum|pus|stool` (specimen) or `co|ho` (setting). Organism codes `TOTAL` and `OTHER` are the printed
總計/其他 rows. Ranks are as printed: ties exist, and one apparent source typo (2019 CO, rank 8 printed twice).

### `antibiotic_use.json` — provisional
`{year, level, setting:'inpatient', atc, className, aware, metric:'DID', value}`, in DDD per 1,000 patient-days. 22 classes
plus `TOTAL` (J01, equal to the sum of the classes), for 4 levels × 2017–2024. `level:'all'` is the patient-day-weighted mean.
The model includes the COVID-era pattern: respiratory-indication classes dip in 2020–21 and rebound in 2023, surgical
prophylaxis dips in 2021, and broad-spectrum classes rise in 2021–22. `dims.classes[].meta.aware` gives the WHO AWaRe category.
Sum classes by `aware` (excluding `TOTAL`) for AWaRe shares.

### `hai.json` — provisional
`{year, level, icu_type, metric, value, unit}`. Densities are per 1,000 patient-days, device-associated rates per 1,000
device-days, and utilisation is a ratio. Published combinations are: level `all` × all 8 ICU types and `all`;
`medical_center` × 8 types and `all`; `regional` × 6 types and `all`; `district` × `all`. Values are internally consistent,
because the model aggregates device-days and infection counts.

### `hai_pathogens.json` — provisional
`{year, level, site, rank, pathogen, pct}` gives the top 10 per (year, level ∈ all/medical_center/regional, site ∈ all/bsi/uti/pneu).
`pct` is the share of HAI isolates at that site.

### `glass.json` — provisional
`{iso3, country, whoRegion, year, indicator, resistant_pct, isolates|null, source}`: 41 countries across all 6 WHO
regions plus `TWN`. External values are approximate (bloodstream, ~2021–2022) and `isolates` is null. **TWN rows
are recomputed at every build** from `resistance.json` in this order:
1. blood, national, CO+HO, drug-level (antibiotic preference from `dims/glass.json`, e.g. MEM > IPM > ETP);
2. else the MDRO phenotype indicator (national, CO+HO, all specimens);
3. else the antibiogram (national, all specimens).
`meta.comparability.TWN[indicator]` records the tier, antibiotic, year, precision, measure (non-susceptible vs resistant)
and whether it is a fallback. `meta.comparability.caveats` lists comparability caveats (CLSI vs EUCAST, isolate- vs
patient-based counting, Taiwan's non-participation in GLASS).

### `meta.json`
`latestYear`, `yearsAvailable`, `provisional` (false once the AMR reports are ingested), `provisionalDatasets`,
`ingestion {status, pdfs[{file, reportYear, sha256, status}]}`, `lastBuild`, `contentDigest`, and
`records` = a per-dataset catalogue `{dataset, file, records, provisional, yearMin, yearMax}`.

## 4. Code lists (source of truth: `data/curated/dims/*.json`)
* **Organisms**: SAU, CNS, ENC (Enterococcus spp.), EFM, EFA, SPN, GAS, GBS, CDI, ENB (Enterobacterales), ECO, KPN,
  ENT (Enterobacter spp., isolate tables), ECL (E. cloacae, antibiograms), PRO (Proteus spp.), PMI (P. mirabilis),
  CIT, SER (Serratia spp.), SMR (S. marcescens), MOR, PRV, SAL (Salmonella spp.), NTS, SHI, PAE, ABA, SMA, BCC, CIN, ELI,
  HIN, NGO, HPY, BFR, CAL, CSP, OTHER, TOTAL. Unknown names get an auto code `X-…` and a build warning.
* **Antibiotics**: 74 WHONET-style codes (OXA, PEN, PEV, AMP, AMX, AMC, SAM, TZP, CZO, CXM, CXA, FOX, CTX, CRO, CAZ, CFP,
  CFM, FEP, ATM, IPM, MEM, ETP, DOR, GEN, GEH, AMK, CIP, LVX, MFX, ERY, AZM, CLR, CLI, TCY, MNO, TGC, VAN, TEC, DAP, LNZ,
  QDA, COL, SXT, CHL, RIF, NIT, MTR, …). `meta.thas` holds the printed abbreviations, and `meta.aware` / `meta.atc` are included.
* **Phenotypes**: CRAB, CRE, CR-ECO, CRKP, CR-ENT, CRPA, 3GC-R-ECO, 3GC-R-KPN, MRSA, VRE (Enterococcus spp.),
  VR-EFA, VR-EFM, PNSP. The reports currently provide the first nine (apart from CR-ENT); the others are reserved.
* **Levels** all/medical_center/regional/district · **settings** all/co/ho · **specimens** all/blood/urine/sputum/pus/stool
  · **precisions** table/text/chart_estimate · **AMU classes** PEN, AMC_SAM, PIP_TAZ, CEPH1–4, BL_NOVEL, CARB, FQ, GLYCO,
  AMINOG, MACRO, LINCO, TETRA, GLYCYL, POLY, OXAZ, LIPO, SXT, NITRO, OTHER, TOTAL · **ICU types** medical, surgical,
  mixed, cardiac, neuro, pediatric, neonatal, burn · **GLASS indicators** as in the contract · **WHO regions** AFR, AMR,
  SEAR, EUR, EMR, WPR.

## 5. Provisional policy (machine-enforced)
* `resistance` and `isolates` are `provisional:false` when `map_amr.py` mapped at least one row (`_provenance.json` status `ingested`).
* AMU, HAI and HAI pathogens stay `provisional:true` until a mapper (`map_amu.py` / `map_hai.py`) records
  `status:"ingested"` **and** no `origin=model` rows remain in the curated CSV. A failed mapper records `failed` and
  leaves the provisional CSV untouched.
* `glass` is always provisional, because its external values are approximate.
* Provisional envelopes have version suffix `-provisional`, list the `tw-amr-watch-model` source first, and carry a
  localized note telling the user how to add the PDF.

## 6. How to update
```bash
pip install -r scripts/requirements.txt          # jsonschema (+ pdfplumber for extraction)
python3 scripts/ingest/parse_isolate_tables.py raw/*.pdf   # 表 2-x -> transcribed/<year>/isolate_counts.csv
# (transcribe figures per docs/TRANSCRIPTION.md into data/source/transcribed/<year>/)
python3 scripts/build_data.py                    # map + validate + write public/data and public/api/v1
python3 scripts/build_data.py --check            # CI: fails if outputs are stale
```
* New edition: add the PDF to `raw/` (keep the CE year in the file name), add `"<year>": "<source id>"` to
  `data/curated/_config.json → reportSources` and the matching SourceRef to `data/curated/sources.json`, then parse and transcribe.
* AMU/HAI reports: see `data/source/README.md`. `bash scripts/ingest/run_all.sh` runs everything that is automatic.
* Regenerate the provisional model CSVs (rarely needed): `python3 scripts/ingest/model_provisional.py`
  (refuses to overwrite an ingested dataset).
* GitHub Actions (`.github/workflows/ingest.yml`) runs `run_all.sh` on pushes touching `raw/*.pdf`,
  `data/source/transcribed/**` or `data/curated/**`, commits the regenerated `public/data` and `public/api`, and triggers the Pages deploy.
* The build is deterministic. `generatedAt` changes only when content changes (or set `SOURCE_DATE_EPOCH`), and any
  contract violation (unknown code, duplicate key, schema error, AMU total ≠ sum) exits 1.
