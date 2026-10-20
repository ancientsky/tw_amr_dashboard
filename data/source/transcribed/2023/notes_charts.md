# 2023 report: chart transcription notes (參-二 圖 3-2-x and 肆 圖 4-x-y-z)

Source: 臺灣抗生素抗藥性監視年報 2023 (中華民國 112 年; published 113 年 12 月), `raw/臺灣抗生素抗藥性監視年報(2023年).pdf`.
Data years ROC 107–112 = CE 2018–2023. Printed page N = PDF page N+9 (checked against footers, e.g. printed 53 = PDF 62, printed 69 = PDF 78).
`pdf_page` in every CSV is the 1-based PDF page index.

| file | rows | content |
|---|---|---|
| `pathogen_resistance.csv` | 339 | 圖 3-2-1 … 3-2-12 (PDF 62–76), % resistant (R+I) for 12 pathogens, settings all/co/ho, specimens all/blood/urine/pus/stool |
| `mdro_trends.csv` | 648 | 圖 4-k-j-2 (PDF 78–112): 9 phenotypes × 3 settings × 4 levels × 6 years, all complete, 0 unreadable |
| `mdro_counts.csv` | 810 | 圖 4-k-j-1: totals by level for all/co/ho (486 rows) + I+R segment of the CO and HO charts (324 rows, organism suffixed ` (I+R)`) |

## How the values were read

- Every chart is a raster image embedded in the PDF. The native images were pulled with `pdfimages` (about 150–270 ppi, no resampling). Images that came with a soft mask were composited onto white. Values were then measured with Pillow/numpy pixel analysis, which is more precise than eyeballing the 150-dpi page renders. The page renders were used only to identify panels and labels. The helper scripts live in the scratchpad (`w2023/`), not in the repo.
- **Axis calibration.** For bar charts, the 0 % and 100 % tick centres are found on the x-axis of each panel. For line and count charts, the 0 position is the axis line, and the scale comes from the spacing between the tops of the y-axis labels. The axis maximum of each chart was read visually.
- **Pathogen bars (圖 3-2-x).** The bar end is measured with sub-pixel antialias interpolation. Raw bar-end readings run about 0.3 percentage points high across every image resolution, which points to a 1-px offset in the original Excel render. 38 values stated in the narrative were used to check this: mean bias +0.33 pp, SD 0.09, range 0.13–0.54. A correction of −0.32 pp was applied before rounding. The midpoints of the error bars agree with the corrected bar ends. `bar_estimate` values are rounded to the nearest 0.5. `ci_low`/`ci_high` are the cap positions of the Wilson 95 % CI whiskers, rounded to the nearest 0.5 and clamped so that ci_low ≤ value ≤ ci_high. For very small CIs, the caps sit inside the bar end, so the CI may collapse onto the value.
- **Line charts (圖 4-k-j-2).** Each series is isolated by its legend colour (醫學中心 blue, 區域醫院 orange, 地區醫院 grey, 全國 yellow). The marker centre is measured at each year's x position. When another series' marker covers a marker, the value comes from a robust straight-line fit to the visible parts of the adjacent line segments, evaluated at the year position. The two methods agree within about 0.3 px where both are available. Check: the national value recomputed as the count-weighted mean of the three levels (using the 圖 4-k-1-1 totals) matches the national value read from the chart with a median absolute difference of 0.05 pp over all 162 phenotype × setting × year points.
- **Stacked count bars (圖 4-k-j-1).** Segment boundaries are found by colour transition along the bar centre, with sub-pixel blending. Totals are rounded to the nearest 100, or to the nearest 50 when below 1,000, as instructed. Resolution is roughly 0.4–9.5 px per 100 isolates depending on the chart: CRE and CR-E. coli are coarsest, at about 250 isolates/px.

## Narrative (`read_method=text`) values used

- 3-2-1 A. baumannii all/all: tigecycline 29.0.
- 3-2-2 E. coli FQ: all/all cipro 43.9, levo 44.5; blood cipro 40.5, levo 41.8; urine cipro 44.0, levo 44.6.
- 3-2-3 K. pneumoniae all/all: meropenem 12.0, doripenem 19.7, cipro 36.8, levo 36.7. Ceftazidime blood 29.1, urine 40.4. Co-trimoxazole blood 32.8, urine 44.2.
- 3-2-4 P. aeruginosa all/all: doripenem 9.2, cipro 18.9, levo 24.6.
- 3-2-5 E. faecalis all/all: daptomycin 25.1. 3-2-7 S. aureus all/all: oxacillin 45.5. 3-2-8 N. gonorrhoeae all/all: ciprofloxacin 97.4.
- 3-2-9 S. pneumoniae all/all: penicillin G 29.1, ceftriaxone 11.6, cefotaxime 25.0, co-trimoxazole 41.5. Blood co-trimoxazole 48.1.
- 3-2-10 Shigella all/all: cipro 37.5, ceftriaxone 9.0, cefotaxime 15.4. Stool cipro 85.7.
- 3-2-11 NTS all/all: ceftriaxone 12.1, ceftazidime 19.3, cipro 33.0, levo 25.1.
- 3-2-12 H. influenzae all/all: ampicillin 60.8, co-trimoxazole 69.0, cipro 33.1, levo 34.7.
- 肆: CRAB national (all) 2018 53.0 and 2023 61.9. VR E. faecalis district (all) 2018 2.6 and 2023 1.5.

**Ranges assigned to specific drugs.** Several narrative statements give a range ("介於 a%–b%") rather than per-drug values. The endpoints were assigned to a drug only when the bar measurements picked out the lowest and highest drug unambiguously. For K. pneumoniae ciprofloxacin vs levofloxacin (36.8 vs 36.7), the two bars differ by only 1 px; the bars show cipro as the higher one. The following ranges could **not** be assigned and stay as bar estimates:
- A. baumannii carbapenems 64.9–65.2: the three bars are within 1 px.
- E. coli carbapenems 2.1–2.2: four identical bars.
- P. aeruginosa imipenem/meropenem 13.1: identical bars.

**Qualitative bounds used as caps.** The narrative says E. faecalis all/all ampicillin, vancomycin and tigecycline are "<1 %", and NTS all/all carbapenems are "<1 %". Those bar estimates were capped at 0.5.

**Tiny and zero bars.** A visibly drawn bar is never recorded as 0; its floor is 0.5. Rows recorded as 0.0 are panels where no bar is drawn but a whisker starts at 0 (point estimate 0 %, upper CI read from the whisker): E. faecalis blood tigecycline; NTS blood imipenem and meropenem; NTS stool meropenem; H. influenzae blood ceftriaxone. Bars below about 2 % have about ±0.5 pp uncertainty.

## Suppressed cells (marked "*", n < 20): omitted, no row written

- N. gonorrhoeae: all/all and co/all azithromycin, spectinomycin, gentamicin. Pus: cefixime, azithromycin, spectinomycin, gentamicin. HO: every drug.
- S. pneumoniae: oxacillin in blood and in HO.
- Shigella spp.: all/all levofloxacin and azithromycin. Stool: levofloxacin, ceftazidime, azithromycin. CO: levofloxacin, ceftazidime, azithromycin. HO: every drug.
- NTS: doripenem in every panel.
- K. pneumoniae has no ampicillin bar (by design). Specimen panels in this edition:
  - A. baumannii, P. aeruginosa, E. faecalis, E. faecium, S. aureus, S. pneumoniae, H. influenzae: all + blood.
  - E. coli, K. pneumoniae: all + blood + urine.
  - N. gonorrhoeae: all + pus (膿或傷口).
  - Shigella: all + stool.
  - NTS: all + blood + stool.
  - The CO and HO panels are always 全部檢體 only.

## 肆 count charts: structure and the I+R rows

- The **CO+HO chart 圖 4-k-1-1** stacks **CO (light) + HO (dark)** for each level. Only its bar **total** is written, as `infection_setting=all`.
- The **CO chart 圖 4-k-2-1 and the HO chart 圖 4-k-3-1** stack **I+R (light) + S (dark)**, per their legends. Their totals are written as `co` and `ho`. These charts have 1–5× finer scales than the CO+HO chart, so they give the more precise co/ho totals. Their I+R segments are written as extra rows with organism `"<organism> (I+R)"`. These are resistant-isolate counts; the schema has no column for resistance status. Filter on the organism name without the suffix to get totals only. Small I+R segments (a few px) are coarse.
- The CO/HO segments of 圖 4-k-1-1 were measured but **not written**, to avoid duplicate keys. They agree with the CO/HO chart totals, with the CO+HO chart reading a median +10 to +50 isolates higher (≈1 px). The exceptions are CRE and CR-E. coli CO, at about +270 and +120 (≈1 px at 0.4–0.6 px/100). As a result, `all` ≠ `co` + `ho` exactly.
- Cross-checks:
  - I+R ÷ total from the CO/HO charts reproduces the line-chart % for the same level/year, with a median difference of about 0 pp. Outliers of 1–3 pp occur only on small district bars.
  - National isolates per hospital computed from the 圖 4-k-1-1 totals (÷159 hospitals in 2018, ÷295 in 2023) run 1–3.5 % above the narrative's "平均每家醫院檢出之菌株數" for every phenotype. Example, CRAB: 145/86 vs the text's 141/83. This is consistent with the CO/HO split counting a patient once per setting, so the transcribed totals are left as read.
- Organisms are written in full: Acinetobacter baumannii (the AB complex per 壹-五-(三)), Enterobacterales, Escherichia coli (the captions print "E. coli"), Klebsiella pneumoniae, Pseudomonas aeruginosa, Staphylococcus aureus, Enterococcus spp., Enterococcus faecalis, Enterococcus faecium.
- Axis maxima, as all / co / ho:

| | all | co | ho |
|---|---|---|---|
| CRAB | 14k | 6k | 8k |
| CRE | 160k | 140k | 30k |
| CR-E. coli | 120k | 100k | 14k |
| CRKP | 40k | 30k | 14k |
| CRPA | 30k | 25k | 12k |
| MRSA | 40k | 30k | 7k |
| VRE | 40k | 25k | 16k |
| VR-EFA | 25k | 18k | 6k |
| VR-EFM | 16k | 6k | 12k |

## 肆 trend charts: occlusions and inferred points

- Overlapping series were frequent: CRPA, VRE, VR-EFM, CRE, VR-EFA and CRKP regional, where the medical-centre/regional markers sit behind the national marker. Those points were taken from the segment fit; see the method above.
- Two markers were completely hidden, and no line segment was visible on either side:
  - CRPA all medical_center 2018 = 10.5. The 1-px blue line edge is visible at about 10.4, and the count-weighted back-calculation gives 10.35.
  - VR-EFM all medical_center 2023 = 51.5. The top of the blue marker is visible above the national marker, giving 51.7; the back-calculation also gives 51.7.
  
  Both are recorded as `bar_estimate`.
- Line-chart y-axis maxima:

| | all | co | ho |
|---|---|---|---|
| CRAB | 100 | 100 | 100 |
| CRE | 10 | 10 | 30 |
| CR-ECO | 6 | 5 | 20 |
| CRKP | 20 | 20 | 50 |
| CRPA | 30 | 30 | 40 |
| MRSA | 80 | 100 | 100 |
| VRE | 30 | 20 | 50 |
| VR-EFA | 4 | 5 | 10 |
| VR-EFM | 80 | 100 | 100 |

- **Low-range series.** Rounding to 0.5 per the contract hides much of the movement in the charts with small axes. The raw 0.1-precision readings are below; read precision there is about ±0.05–0.1 pp.

| phenotype | setting | level | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 |
|---|---|---|---|---|---|---|---|---|
| CRE | all | national | 4.7 | 4.7 | 4.6 | 4.9 | 5.1 | 5.3 |
| CRE | all | medical_center | 5.8 | 5.2 | 4.5 | 4.4 | 4.6 | 4.7 |
| CRE | all | regional | 3.6 | 4.0 | 4.4 | 5.0 | 5.1 | 5.1 |
| CRE | all | district | 5.9 | 5.8 | 5.7 | 6.6 | 6.0 | 7.0 |
| CRE | co | national | 3.6 | 3.5 | 3.3 | 3.6 | 3.6 | 3.7 |
| CRE | co | medical_center | 4.6 | 4.0 | 2.9 | 2.9 | 3.1 | 3.0 |
| CRE | co | regional | 2.7 | 3.0 | 3.4 | 3.8 | 3.9 | 3.7 |
| CRE | co | district | 4.8 | 4.7 | 4.6 | 5.3 | 4.6 | 5.4 |
| CR-ECO | all | national | 1.9 | 1.7 | 1.4 | 1.9 | 1.9 | 2.3 |
| CR-ECO | all | medical_center | 3.0 | 2.2 | 1.1 | 1.1 | 1.2 | 1.4 |
| CR-ECO | all | regional | 1.0 | 1.1 | 1.4 | 2.0 | 2.1 | 2.3 |
| CR-ECO | all | district | 3.5 | 3.2 | 3.0 | 4.2 | 3.5 | 4.1 |
| CR-ECO | co | national | 1.7 | 1.5 | 1.2 | 1.5 | 1.5 | 1.8 |
| CR-ECO | co | medical_center | 2.8 | 2.0 | 0.8 | 0.8 | 0.9 | 1.0 |
| CR-ECO | co | regional | 0.8 | 1.0 | 1.2 | 1.7 | 1.7 | 1.8 |
| CR-ECO | co | district | 3.2 | 2.7 | 2.4 | 3.6 | 2.8 | 3.3 |
| VR-EFA | all | national | 0.9 | 0.7 | 0.6 | 0.7 | 0.6 | 0.6 |
| VR-EFA | all | medical_center | 0.9 | 0.6 | 0.5 | 0.3 | 0.3 | 0.3 |
| VR-EFA | all | regional | 0.7 | 0.6 | 0.6 | 0.8 | 0.8 | 0.6 |
| VR-EFA | all | district | 2.6 | 2.5 | 2.3 | 1.9 | 1.2 | 1.5 |
| VR-EFA | co | national | 0.8 | 0.6 | 0.5 | 0.5 | 0.4 | 0.4 |
| VR-EFA | co | medical_center | 0.9 | 0.6 | 0.4 | 0.4 | 0.3 | 0.2 |
| VR-EFA | co | regional | 0.5 | 0.5 | 0.4 | 0.5 | 0.5 | 0.4 |
| VR-EFA | co | district | 1.8 | 2.2 | 1.7 | 1.3 | 0.7 | 1.0 |
| VR-EFA | ho | national | 1.2 | 1.0 | 1.1 | 1.3 | 1.4 | 1.2 |
| VR-EFA | ho | medical_center | 0.8 | 0.7 | 0.6 | 0.4 | 0.5 | 0.5 |
| VR-EFA | ho | regional | 1.6 | 1.2 | 1.4 | 2.4 | 2.5 | 1.7 |
| VR-EFA | ho | district | 6.5 | 3.9 | 5.6 | 4.4 | 2.9 | 3.8 |

## Source errata noticed (logical figure numbers were used)

- PDF 80: the HO count chart is captioned "圖 4-1-3-2". It is written as 圖 4-1-3-1.
- PDF 88: the HO count chart is captioned "圖 4-3-2-1". It is written as 圖 4-3-3-1.
- PDF 97: the MRSA heading calls S. aureus "綠膿桿菌" and says "自 106 年" (should be 107).

These typos do not affect the data.

## Confidence

- pathogen_resistance: high. Values ≥ 2 % are within ±0.5 pp; bars below 2 % are within about ±0.5 pp.
- mdro_trends: high. Weighted-national check median |Δ| = 0.05 pp; 0 unreadable.
- mdro_counts totals: medium-high. ±1 px, i.e. ±10–250 isolates depending on chart scale.
- mdro_counts I+R rows: medium for large segments, low for segments only a few px tall.
