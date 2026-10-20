# 2022 report: chart transcription notes (參-二 圖 3-2-x and 肆 圖 4-x-y-z)

Source: 台灣抗生素抗藥性監視年報 2022 (中華民國 111 年, Word-made edition), `raw/台灣抗生素抗藥性監視年報2022年.pdf`.
Data years ROC 106–111 = CE 2017–2022 (CE = ROC + 1911). For the pages used here, printed page = PDF page − 11 (checked against footers: PDF 66 = printed 55, PDF 82 = printed 71, PDF 116 = printed 105).
`pdf_page` in every CSV is the 1-based PDF page index.

| file | rows | content |
|---|---|---|
| `pathogen_resistance.csv` | 340 | 圖 3-2-1 … 3-2-12 (PDF 66–80, printed 55–69): % resistant for 12 pathogens. Settings all/co/ho; specimens all/blood/urine/pus/stool. 35 `text`, 305 `bar_estimate` |
| `mdro_trends.csv` | 648 | 圖 4-k-j-2 (PDF 82–116): 9 phenotypes × 3 settings × 4 levels × 6 years. Complete, 0 unreadable. 3 `text` |
| `mdro_counts.csv` | 810 | 圖 4-k-j-1: totals by level for all/co/ho (486 rows), plus the I+R segment of the CO and HO charts (324 rows; organism suffixed ` (I+R)`; 12 of them `unreadable`) |

## Text layer

The text dump (`report1.txt`) for PDF 66–116 holds only headings, narrative and captions. Word did not leave data labels or table values in the text layer: every chart is an embedded raster image (`pdfimages -list`: 150–245 ppi, a few JPEG). Values therefore come from pixel measurement, except where the narrative states a number. Those cases are listed below and marked `read_method=text`.

## How the values were read

- The native chart images were extracted with `pdfimages -png` (no resampling) and measured with Pillow/numpy. The helper scripts are in the scratchpad (`w2022/`), not in the repo. The 150-dpi page renders were used only to identify panels and labels. Image-to-panel assignment used the image placement on the page (`pdftohtml -xml`), because Word embedded several images out of visual order:
  - p72 (E. faecalis): the first image is the CO/HO row.
  - p73 (E. faecium): the first image is the CO panel.
  - p79 (Salmonella): HO comes before CO.
  - p80 (H. influenzae): HO comes before CO.

  The narrative confirms the mapping. For example, E. faecalis all/all daptomycin reads 25.56 from the top-row image against 25.6 in the text, while the CO panel reads 23.6.
- **Pathogen bars (圖 3-2-x).** Each panel is calibrated from its 0 % and 100 % x-axis tick marks. The bar end is taken from the outer rows of the bar, away from the error-bar caps.

  In most images, the bar drawn by Word ends about 1.5–2.75 px beyond the centre of its own error bar (a bar outline). The offset was measured per image as the median of bar end minus whisker-cap midpoint, using bars at 15–85 % with narrow CIs, and subtracted before conversion. The offset is 0 px for the A. baumannii and P. aeruginosa images. A default of 1.5 px was used where no bar qualified (N. gonorrhoeae, Shigella).

  Check against the 35 values stated in the narrative: mean |bar − text| = 0.09 pp, max 0.28 pp, mean signed +0.02 pp.

  The E. coli blood panel (in a JPEG together with the urine panel) has no drawn x-axis line or ticks. It was calibrated from the x-axis tick-label centres (0 % = x 209, 100 % = x 673). Its narrative check passes: cipro 38.4 vs 38.5, levo 39.7 vs 39.7.
- **Rounding, pathogen bars.** `bar_estimate` values are rounded to the nearest 0.5. A visibly drawn bar is never written as 0; its floor is 0.5. This affects E. faecalis vancomycin, ampicillin and tigecycline, which the narrative says are "<1 %". `ci_low`/`ci_high` are the whisker-cap centres, rounded to 0.5 and clamped so that ci_low ≤ value ≤ ci_high. For very narrow CIs (E. coli, K. pneumoniae: ±0.3 pp) the CI collapses to about ±0.5. Bars under about 2 % carry about ±0.5 pp uncertainty.
- **Line charts (圖 4-k-j-2).** Series are separated by legend colour: 醫學中心 blue (68,114,196), 區域醫院 orange (237,125,49), 地區醫院 grey (165,165,165), 全國 yellow (255,192,0). The zero is the x-axis line. The scale comes from a linear fit to the y-axis label centres; the label maximum and step were read visually for each chart. The marker centre is measured at each year label's x position, with sub-pixel edges.

  Draw order is blue → orange → grey → yellow, so a marker can only be covered by a later series. When one edge is covered, the centre comes from the free edge ± the marker radius (12.9 px diameter). When both edges are covered or the marker is invisible, three fallbacks were used:
  - (a) A straight-line fit to the visible adjacent line segments, evaluated at the year x (15 points). Where markers are visible, this agrees with the marker reading within about 0.05–0.1 pp.
  - (b) The visible 1–3 px "crescent" of the covered marker against the covering marker: centre = crescent edge ± radius (36 points).
  - (c) If no pixel of the series is visible, the marker is fully covered by an equal-size later marker, so its centre lies within about 1 px of the covering one, and that value was taken (12 points).

  These cases are concentrated in charts where lines coincide: VR-EFM all/co/ho, VR-EFA co, CR-E. coli all, CRPA co/ho, VRE co/ho. They are reliable to about 1 px.

  Global check: the national value recomputed as the count-weighted mean of the three level values (with the 圖 4-k-j-1 totals) matches the national value read from the chart. Median absolute difference 0.05 pp, mean 0.09, max 0.53 (MRSA HO 2022), over 162 phenotype × setting × year points.
- **Rounding, line charts.** Precision depends on the axis. Charts with ≤ 0.1 pp per pixel (axis max ≤ 30) are rounded to 0.1: CRE, CR-E. coli, CRKP all/co, CRPA all/co, VRE all/co, VR-EFA. Coarser charts (axis max 40–100: CRAB, CRKP ho, CRPA ho, MRSA, VRE ho, VR-EFM) are rounded to 0.5 as instructed. A uniform 0.5 step would have erased the VR-EFA series, whose values are 0.3–0.8 %.
- **Stacked count bars (圖 4-k-j-1).** Calibration uses the axis line plus the tops of the y-axis label digits; label centres are biased by the comma descenders. Segment boundaries come from the colour transition along each bar's central columns, taking the median over columns. Resolution ranges from about 9 to 290 isolates/px; CRE (287/px) and CR-E. coli (176–182/px) are the coarsest.

  Totals are rounded to the nearest 100, or to the nearest 50 below 1,000, as instructed. Exception: values below 100, which only occur in I+R segments, are rounded to the nearest 10 with a floor of 10, so that a visible segment does not round to 0.

## Narrative (`read_method=text`) values used

- 3-2-1 A. baumannii-calcoaceticus complex all/all: tigecycline 30.0. The carbapenem range "62.8 %–65.4 %" was assigned by bar ranking: meropenem 65.4 (bar 65.5) and doripenem 62.8 (bar 62.9). Imipenem (64.3) is in between and stays a bar estimate.
- 3-2-2 E. coli all/all: doripenem 1.7, meropenem 3.2 (both named), ciprofloxacin 41.6 and levofloxacin 42.7 (FQ range; bars 41.7 / 42.8). Blood: cipro 38.5, levo 39.7. Urine: cipro 41.6, levo 42.6.
- 3-2-3 K. pneumoniae all/all: meropenem 12.6, doripenem 17.6 (named). Ceftazidime: blood 28.4, urine 39.0. Co-trimoxazole: blood 31.3, urine 42.3.
- 3-2-4 P. aeruginosa all/all: doripenem 8.1, meropenem 12.6 (named), ciprofloxacin 18.6, levofloxacin 24.8 (FQ range, unambiguous).
- 3-2-5 E. faecalis all/all: daptomycin 25.6. 3-2-7 S. aureus all/all: oxacillin 43.9. 3-2-8 N. gonorrhoeae all/all: ciprofloxacin 97.6.
- 3-2-9 S. pneumoniae all/all: penicillin G 31.5, ceftriaxone 17.8, cefotaxime 31.3 (3rd-GC range, unambiguous). Blood: penicillin G 58.3.
- 3-2-10 Shigella spp. all/all: ciprofloxacin 47.8, ceftazidime 6.9 (lower end of the 3rd-GC range; bar 7.1, clearly the lowest). Stool: ciprofloxacin 88.3.
- 3-2-11 Salmonella spp. all/all: ceftriaxone 7.6 (lower end of the 3rd-GC range, unambiguous).
- 3-2-12 H. influenzae all/all: ampicillin 59.2, trimethoprim/sulfamethoxazole 73.0, ceftriaxone 3.2.
- 肆:
  - CRAB national (all) 2017 = 53.2 and 2022 = 64.6 (chart reads 53.3 / 64.8).
  - VR E. faecalis district (all) 2022 = 1.1 (chart 1.08).

**Ranges not assigned (left as bar estimates).**
- K. pneumoniae FQ "35.4 %–35.6 %": the cipro and levo bars are identical, 35.5.
- Shigella 3rd-GC upper end 11.2: ceftriaxone 11.3 vs cefotaxime 11.05, within 1 px.
- Salmonella 3rd-GC upper end 13.6: cefotaxime 13.4 vs ceftazidime 13.1.

**Qualitative statements, all consistent with the bars.**
- E. faecium: ampicillin >90 % (91.8), vancomycin >55 % (55.8), daptomycin/linezolid/tigecycline ≤ 3 % (3.1 / 2.0 / 1.1).
- Salmonella carbapenems <3 %.

## Narrative statements that disagree with the charts (not used)

- **VR E. faecium (p113).** The text gives 106–111 ranges: district 52.8–61.9 %, medical centre 51.5–56.0 %, regional 49.2–54.4 %. Figure 4-9-1-2 shows district at 63.8 % (2018) and 63.3 % (2020), and regional 54.8–57.3 % in 2018–2021. In the regional case, the orange marker visibly sits just above the yellow national line, which is itself 54.4–57.1 %. The chart readings were kept. The narrative may come from an earlier data cut.
- **VR E. faecalis district (p109).** The text says "2.6 % 降至 1.1 %". The chart reads 2.39 for 2017 and 2.58 for 2018, so 2.6 matches 2018, not 2017. Only the 2022 value of 1.1 was used as text.

## Suppressed cells (marked "*", n < 20): omitted, no row written

- N. gonorrhoeae:
  - all/all and co/all: azithromycin, spectinomycin, gentamicin.
  - Pus (膿或傷口): cefixime, azithromycin, spectinomycin, gentamicin.
  - HO: every drug (whole panel).
- S. pneumoniae: oxacillin in blood and in HO.
- Shigella spp.:
  - all/all: azithromycin.
  - Stool: levofloxacin, azithromycin.
  - CO: levofloxacin, azithromycin.
  - HO: every drug (whole panel).
- Salmonella spp.: doripenem in all 5 panels.
- H. influenzae: blood ciprofloxacin and levofloxacin.

376 drawn label slots − 36 suppressed = 340 rows.

Specimen panels in this edition:
- A. baumannii, P. aeruginosa, E. faecalis, E. faecium, S. aureus, S. pneumoniae, H. influenzae: all + blood.
- E. coli, K. pneumoniae: all + blood + urine (K. pneumoniae has no ampicillin bar).
- N. gonorrhoeae: all + pus.
- Shigella: all + stool.
- Salmonella spp.: all + blood + stool. This edition prints "Salmonella spp.", not "NTS".

CO and HO panels are always 全部檢體 only. Antibiotic names are as printed on the chart axes, for example "Co-trimoxazole" (Enterobacterales, S. pneumoniae) vs "Trimethoprim/Sulfamethoxazole" (H. influenzae), "Gentamicin-High", "Penicillin G" and "Piperacillin/Tazobactam".

## 肆 count charts: structure

- **CO+HO chart 圖 4-k-1-1.** Stacks **CO (light, bottom) + HO (dark)** for each level. Its bar total is written as `infection_setting=all`.
- **CO chart 圖 4-k-2-1 and HO chart 圖 4-k-3-1.** Stack **I+R (light, bottom) + S (dark)**, per their legends. Their totals are written as `co` and `ho`; these charts have equal or finer scales than the CO+HO chart.

  The I+R segments are written as extra rows with organism `"<organism> (I+R)"`, the same convention as the 2023 notes. These are resistant-isolate counts; the schema has no resistance-status column. Filter out the suffix to get totals only. 12 I+R segments are not visible (< 1 px) and are written empty with `unreadable`:
  - E. coli co district 2017–2018.
  - E. faecalis co district 2017–2022 and co regional 2020.
  - E. faecalis ho district 2017–2019.
- **Cross-check.** The CO and HO segments of the CO+HO chart agree with the CO and HO chart totals to within about 1 px everywhere (for example CRAB within 40 isolates, CRE within 270 at 287/px). After rounding, co + ho vs all differs by ≤ 5 % except E. faecium district 2017 (450 vs 400, a small bar).
- **Count organism names as printed:**
  - CRAB: Acinetobacter baumannii-calcoaceticus complex (2023/2024 print "Acinetobacter baumannii").
  - CRE: Enterobacterales.
  - CR E. coli: Escherichia coli.
  - CRKP: Klebsiella pneumoniae.
  - CRPA: Pseudomonas aeruginosa.
  - MRSA: Staphylococcus aureus.
  - VRE: Enterococcus spp.
  - VR E. faecalis: Enterococcus faecalis.
  - VR E. faecium: Enterococcus faecium.
- **Extra year in 圖 4-8-3-1.** The VR E. faecalis HO count chart (p112, printed 101) has 7 year groups, 105–111 年, although the caption says 106–111. Its 106–111 bars match the HO segments of 圖 4-8-1-1, so the extra group is ROC 105 = 2016. The 2016 values are kept out of the CSV to respect the 2017–2022 coverage:
  - Medical centre: total ≈ 3,900, I+R ≈ 60.
  - Regional: total ≈ 2,200, I+R ≈ 10.
  - District: total ≈ 100, I+R not visible.
- Count charts show only the three hospital levels; no national counts are printed, and none were derived.

## Latest-year national % resistant (all settings, 2022, from mdro_trends)

| phenotype | value |
|---|---|
| CRAB | 64.6 (text) |
| CRE | 7.4 |
| CR-ECO | 2.3 |
| CRKP | 14.4 |
| CRPA | 12.9 |
| MRSA | 44.0 |
| VRE | 20.3 |
| VR-EFA | 0.6 |
| VR-EFM | 55.5 |

## Comparability / methodology remarks

- Resistance in this edition counts I+R as resistant: the count-chart legends say "I+R". For E. faecium daptomycin, a footnote says only R is counted, because CLSI has only SDD/R breakpoints.
- Pathogen-bar error bars are 95 % CIs; the method is not stated. Narrow, near-symmetric CIs in the mid range suggest Wald or Wilson.
- 參-二 percentages are for 111 年 (2022) only. 肆 trend lines cover 106–111 年.

## Confidence

- **High:** narrative-anchored values, and overall structure and mapping.
- **Pathogen bar estimates:** about ±0.3 pp, validated against 35 narrative values.
- **Trend values:** about ±0.1–0.3 pp, validated by the national = weighted-mean check, median 0.05 pp. Covered-marker points (63 of 648) are reliable to about ±1 px.
- **Count totals:** reliable to about ±1 px before rounding, so the 100/50 rounding dominates. I+R segment counts are coarse (a few px) and should be treated as indicative.
