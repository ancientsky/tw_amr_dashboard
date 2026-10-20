# 2024 report: chart transcription notes (參-二 圖 3-2-x, 肆 圖 4-x-y-1 and 4-x-y-2)

Source: 臺灣抗生素抗藥性監視年報 2024 (data 2019–2024, ROC 108–113).
- Section 參-二: printed pp. 53–67, which are PDF pp. 61–75.
- Section 肆: printed pp. 68–103, which are PDF pp. 76–111.
- `pdf_page` in every CSV is the 1-based PDF page index (printed page + 8).
- ROC→CE: 108=2019 … 113=2024.

## Files and row counts

| file | rows | content |
|---|---|---|
| `pathogen_resistance.csv` | 384 | 12 figures (圖 3-2-1 … 3-2-12). Each has 4 panels: (A) CO+HO 全部檢體, (A) a second specimen panel, (B) CO, (C) HO. E. coli, K. pneumoniae and NTS have 3 (A) panels, i.e. 5 panels. One row per pathogen × antibiotic × panel. 49 `text`, 299 `bar_estimate`, 36 `unreadable` (all of these are the report's `*` cells, see below). |
| `mdro_trends.csv` | 648 | Complete 9 phenotypes × 3 settings × 4 levels × 6 years grid. 15 `text`, 633 `bar_estimate`, 0 `unreadable`. |
| `mdro_counts.csv` | 1134 | Stacked bars, 9 organisms × 3 charts × 3 levels × 6 years. 1109 `bar_estimate`, 25 `unreadable`. |

## Method

The charts are raster images embedded in the PDF at 206–270 ppi. They were extracted at native resolution with `pdfimages -png` (sharper than the 150-dpi page renders) and measured by pixel analysis with Pillow/numpy. The helper scripts are in the session scratchpad, not in the repo. Every chart was overlaid with its detected values and checked visually.

### Axis calibration
- **MDRO bar and line charts (y-axis):** tick-label digit centres give the scale, fitted linearly. The residual is ≤0.6 px.
- **Zero line:** zero is anchored on the x-axis line, not on the "0" label. The label centres sit about 1–3 px above the true value position.
- **Section 3-2 (x-axis):** the centres of the 5 tick labels (0/25/50/75/100%) are fitted linearly, with residual ≤0.9 px. Scale is about 4.3–6.2 px per 1%.

### Systematic offsets, found and corrected empirically
1. **Section 3-2 horizontal bars.**
   - Each bar is drawn about **2.1 px longer** than its value; it looks like a same-colour outline. The corrected value is `bar_end − 2.1 px`.
   - This offset was calibrated against 46 values stated in the narrative: median 2.12 px, SD 0.41 px, which is about ±0.08 percentage points.
   - After correction the bar estimates reproduce the narrative values to within about ±0.15 pp.
   - The midpoint of the error bar matches the text only for large n. CIs are visibly asymmetric for small-n panels (Shigella, H. influenzae blood, S. pneumoniae), so they look like Wilson or exact intervals. For that reason the bar end is used as the value, not the CI midpoint.
2. **MDRO line charts.** Marker centres sit about 0.8 px above the true value. This was calibrated on the 15 narrative values (0.5–1.1 px) and corrected globally.
3. **MDRO stacked bars.** The bar base is effectively the bottom edge of the 2-px x-axis line, so +1 px was applied. This was calibrated so that I+R/total from the CO and HO count charts reproduces the line-chart %:
   - median |difference| 0.11 pp over 216 points;
   - the large bars agree to within 0.3 pp.

### Rounding
- **`mdro_trends`:** nearest 0.5 on axes with max ≥20. Nearest 0.1 on small-scale axes (max ≤10: CRE all/co, CR-ECO all/co, VR-EFA all/co/ho), where 1 pp spans 33–83 px and 0.5 rounding would destroy the signal.
- **`pathogen_resistance`:** nearest 0.5. Values below 5% are given to 0.1, because 0.5 rounding would be more than 10% relative error. The pixel resolution is about 0.2 pp.
- **`ci_low` / `ci_high`:** to 0.1, read from the error-bar cap positions. Error bars are not offset (their midpoints match the text for large-n bars). CIs are left empty when the whole error bar is shorter than 3.5 px (78 rows, all large-n bars with CI width ≲0.6 pp), because the cap width dominates there.
- **Counts:** nearest 100, or nearest 50 when below 1,000, as instructed. The real pixel resolution is coarser on large-scale charts. One px is about:
  - 300 isolates on 圖 4-2-1-1 (CRE, axis 200,000);
  - 280 on 4-2-2-1 (160,000);
  - 180–210 on the E. coli charts;
  - 10–70 on the small charts.
  Treat values on the Enterobacterales and E. coli charts as ±300.

### `text` values
`text` is used only where a narrative sentence pins an exact number.
- When the narrative gives a range ("介於 a – b"), it was assigned to the min and max antibiotic only if the measured bars ordered them unambiguously. For example:
  - E. coli 3GC 24.9 = ceftazidime and 34.0 = cefotaxime.
  - K. pneumoniae carbapenem 11.3 = meropenem and 14.8 = imipenem.
  - P. aeruginosa 9.3 = doripenem and 12.6 = meropenem.
- E. coli carbapenems "約 2.5% – 2.7%" were **not** assigned, because imipenem = meropenem ≈ 2.7 and ertapenem = doripenem ≈ 2.5 are tied pairwise. They stay `bar_estimate` (2.7, 2.7, 2.5, 2.5).
- MDRO `text` values come from the 肆 narrative and the 伍 結論 (p.104):
  - CRAB national 2019 55.1 and 2024 58.4; CRAB 2024 MC 49.4, regional 60.2, district 74.6.
  - CRKP national 12.9 → 15.6.
  - CRPA national 11.4 → 13.4; CRPA 2024 district 19.5, MC 10.8, regional 12.9.
  - CR E. coli 2024 3.0. The conclusion only says "CR E. coli 菌株百分比占 3.0%". It is taken as national CO+HO 2024, and the chart reads 2.99.
  - VR E. faecalis district 2.5 → 1.3.
  - In every case the pixel estimate agreed with the text to within 0.1 pp after offset correction.

## Oddities and caveats

### Stacked count charts (圖 4-x-2-1 CO, 4-x-3-1 HO)
- **The CO and HO count charts are not split by CO/HO.** Their legend reads `I+R` (light, bottom) and `S` (dark, top).
  - Only the CO+HO chart 4-x-1-1 is stacked CO / HO.
  - To keep the exact header, the CO/HO-chart segments are stored with organism names suffixed ` [I+R]` / ` [S]` (e.g. `Acinetobacter baumannii [I+R]`, infection_setting `co`). Filter on the exact organism string.
- Plain-organism `co` / `ho` / `all` rows come only from 4-x-1-1. The CO and HO chart totals (I+R + S) agree with the 4-x-1-1 CO/HO segments to within 1–2 px. This is validated in the script.
- **25 `[I+R]` segments are `unreadable`.** They are thinner than 1 px or hidden under the axis line:
  - all 18 VR E. faecalis CO;
  - 6 VR E. faecalis HO;
  - 1 E. coli CO district 2019.
  Their `[S]` rows equal the bar total.

### Hospital-count sanity check
The narrative "全國平均每家醫院檢出之菌株數" (mean isolates per hospital) is consistent with the summed bar totals for every organism. It implies about 324 reporting hospitals in 2024 and about 167 in 2019. For example:
- CRAB 28,200/87;
- Enterobacterales 393,900/1,215;
- S. aureus 84,400/262.

### Axis maxima differ by chart
- Count charts, axis maximum / step:

  | organism | CO+HO | CO | HO |
  |---|---|---|---|
  | CRAB | 14,000/2,000 | 6,000 | 8,000 |
  | CRE | 200,000 | 160,000 | 35,000 |
  | E. coli | 120,000 | 120,000 | 15,000 |
  | K. pneumoniae | 50,000 | 40,000 | 15,000 |
  | P. aeruginosa | 35,000 | 25,000 | 14,000 |
  | S. aureus | 40,000 | 35,000 | 8,000 |
  | Enterococcus spp. | 45,000 | 30,000 | 18,000 |
  | E. faecalis | 30,000 | 25,000 | 8,000 |
  | E. faecium | 20,000 | 7,000 | 15,000 |

- Line charts, axis maximum by setting:

  | phenotype | CO+HO | CO | HO |
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

  None of these axes start above 0.

### Occluded line markers
Series are drawn in the order 醫學中心 → 區域 → 地區 → 全國, so later series cover earlier ones.
- **Partly hidden markers (about 150 points):** recovered from the visible edge of the marker (11 px diameter) or by extrapolating the visible line segments. The two methods agreed to within about 0.3 pp.
- **12 points were fully hidden:**
  - In the CO and HO charts, the value was taken from the I+R/total ratio of the matching count chart (median agreement 0.11 pp elsewhere):
    - VRE co regional 2023 and 2024;
    - VR-EFM co regional 2021 and 2024;
    - VR-EFM ho MC 2022–2024;
    - CR-ECO co regional 2019.
  - In the CO+HO charts, the value is the position of the 全國 marker covering it, with uncertainty about ±0.5 pp (±0.1 pp on small axes):
    - CRE all MC 2019 = 4.2;
    - VR-EFA all regional 2019 = 0.6;
    - VR-EFM all regional 2019 = 55.0;
    - VR-EFM all MC 2021 = 57.5, read from the visible blue line segments.
- **CR-ECO HO 地區醫院 2024 (圖 4-3-3-2)** is clipped at the top of the 0–20 axis, so its marker is not drawn. The line reaches the frame at the 2024 position, giving about 20.0–20.1. The true value may be slightly above 20.

### Section 3-2 panels
- **`*` cells** mean fewer than 20 isolates tested, so the report does not show a value. They are kept as rows with empty `resistant_pct` and `read_method=unreadable`, since the contract has no "suppressed" code. There are 36 such rows:
  - N. gonorrhoeae: HO entirely, plus azithromycin / spectinomycin / gentamicin in the other panels, and cefixime in pus;
  - S. pneumoniae: oxacillin in blood and HO;
  - Shigella: HO entirely, plus levofloxacin and azithromycin, and ceftazidime in stool;
  - NTS: doripenem in every panel.
- **Specimen panels:**
  - blood for A. baumannii, P. aeruginosa, E. faecalis, E. faecium, S. aureus, S. pneumoniae and H. influenzae;
  - blood + urine for E. coli and K. pneumoniae;
  - pus (膿或傷口) for N. gonorrhoeae;
  - stool for Shigella;
  - blood + stool for NTS.
  The CO and HO panels are always 全部檢體.
- **Antibiotic names** are as printed:
  - `Gentamicin-High` means high-level gentamicin.
  - `Penicillin G` and `Piperacillin/Tazobactam` are spelled as printed.
  - E. faecium `Daptomycin*`: per the footnote, only R counts (SDD and I are not counted). The name is stored as `Daptomycin`.
- **Manual readings:** a few tiny bars were read from 8× crops:
  - NG pus ceftriaxone 0.5 [0.2–2.8];
  - NG CO cefixime 1.3 [0.4–6.9];
  - NTS blood meropenem 0.0, which has no bar and an error bar to 2.4;
  - E. faecalis CO ampicillin 0.7, whose error bar is too small to read.

### Cross-section consistency
Section 3-2 and the 肆 trend charts agree:
- E. faecium vancomycin all/CO/HO is 48.0/43.0/52.0 versus 47.8/43.0/52.0.
- E. faecalis vancomycin all/CO/HO is 0.5/0.4/0.7 versus 0.4/0.3/0.7.

## Confidence
- **High** for `text` rows and for MDRO trend points read from unoccluded markers: about ±0.2 pp on 0–100 axes and ±0.03 pp on 0–4/0–10 axes.
- **Medium** for partly or fully occluded trend points, and for count segments on the 120k–200k-scale charts (±300 isolates).
- **Section 3-2 bar estimates:** ±0.3 pp. CIs are good to about ±0.2 pp.
