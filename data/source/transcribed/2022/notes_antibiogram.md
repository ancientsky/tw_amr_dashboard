# 2022 report: antibiogram transcription notes (參-一 臨床分離菌株抗生素敏感性圖譜)

Source: `raw/台灣抗生素抗藥性監視年報2022年.pdf` (臺灣抗生素抗藥性監視年報 2022, published 中華民國 113 年 2 月, made in Word).
Data year: 2022 (ROC 111). Output file: `antibiogram.csv` (report_year=2022, data_year=2022).

## Figures and pages

| level | figure | PDF pages (pdf_page) | printed pages | rows |
|---|---|---|---|---|
| all (全國) | 圖 3-1-1 + 續1–續4 | 45–49 | 34–38 | 407 |
| medical_center (醫學中心) | 圖 3-1-2 + 續1–續4 | 51–55 | 40–44 | 346 |
| regional (區域醫院) | 圖 3-1-3 + 續1–續4 | 56–60 | 45–49 | 378 |
| district (地區醫院) | 圖 3-1-4 + 續1–續4 | 61–65 | 50–54 | 339 |
| **total** | | | | **1470** |

Printed page = PDF page − 11 throughout this section. `pdf_page` in the CSV is the PDF page index, not the printed number. The national narrative is on printed pp.31–33 (PDF 42–44). Printed p.39 (PDF 50) is only a one-line pointer to 圖 3-1-2 to 3-1-4. The `figure` column holds the base figure number, with no "（續 n）" suffix; `pdf_page` tells the continuation pages apart.

Rows per page: all 65/65/112/109/56; medical_center 59/42/106/105/34; regional 59/61/101/106/51; district 56/44/102/98/39.

## Pathogens (20 rows printed in every figure)

Rows per level (all / medical_center / regional / district):

| pathogen | all | MC | RH | DH |
|---|---|---|---|---|
| Enterococcus faecalis | 16 | 12 | 15 | 16 |
| Enterococcus faecium | 16 | 11 | 14 | 15 |
| Staphylococcus aureus | 16 | 14 | 16 | 16 |
| Streptococcus pneumoniae | 22 | 21 | 19 | 17 |
| Citrobacter spp. | 29 | 25 | 28 | 25 |
| Enterobacter cloacae | 29 | 24 | 28 | 25 |
| Escherichia coli | 32 | 26 | 29 | 27 |
| Klebsiella pneumoniae | 31 | 26 | 29 | 27 |
| Morganella spp. | 25 | 24 | 23 | 24 |
| Proteus mirabilis | 29 | 24 | 27 | 25 |
| Providencia spp. | 27 | 23 | 26 | 23 |
| Salmonella spp. | 23 | 20 | 22 | 19 |
| Serratia marcescens | 28 | 26 | 27 | 24 |
| Shigella spp. | 10 | 5 | 5 | 0 |
| Acinetobacter calcoaceticus-Acinetobacter baumannii complex | 19 | 18 | 22 | 18 |
| Campylobacter spp. | 0 | 0 | 0 | 0 |
| Haemophilus influenzae | 22 | 16 | 19 | 15 |
| Helicobacter pylori | 5 | 5 | 0 | 0 |
| Neisseria gonorrhoeae | 9 | 7 | 9 | 8 |
| Pseudomonas aeruginosa | 14 | 14 | 15 | 15 |
| Clostridioides difficile | 5 | 5 | 5 | 0 |

- **Campylobacter spp.** is a printed row, but every cell in it is grey (suppressed) at all four levels, so it has no CSV rows.
- Shigella spp. has no data in the district figure. Helicobacter pylori has no data in the regional or district figures. C. difficile has no data in the district figure.
- Pathogen names follow the print, including `Acinetobacter calcoaceticus-Acinetobacter baumannii complex`. The narrative calls it "Acinetobacter baumannii-calcoaceticus complex"/"ABc".
- Row groupings printed in the figures: Aerobic Gram Positive, Aerobic Gram Negative-Enterobacterales, Aerobic Gram Negative-Non Enterobacterales, and Anaerobes. These are not stored in the CSV.

## Columns / antibiotics (46 codes, 5 sub-tables per level)

1. Penicillins: OX, P-G, P-V, AM, SAM, AMX, AMC. Anti-Pseudomonal Penicillins: PIP, TZP
2. Macrolides: CLR, E. Tetracyclines: TE, MI. Miscellaneous (I): CC, MTZ, RA, SXT, C
3. 1st GC: CZ. 2nd GCs: FOX, FUR, CXM. 3rd GCs: CTX, CRO, CFM. Anti-Pseudomonal 3rd GCs: CFP, CAZ. 4rd GCs: FEP
4. Aminoglycosides: GM, HLG, AN. Fluoroquinolones: CIP, LVX, MXF. Carbapenems: IPM, MEM, ETP, DOR
5. Miscellaneous (II): CL, ATM, TGC, VA, SYN, LZD, DAP, F/M

- `antibiotic_class` keeps the printed header text. This includes the typo **"4rd GCs"** (meaning 4th-generation cephalosporins); normalise it downstream if needed. "Anti- Pseudomonal" breaks across lines in print and is written `Anti-Pseudomonal ...`.
- Generic names come from 附錄 2 (抗生素名稱與簡稱對照表, PDF p.127):
  - FUR = `cefuroxime sodium` (parenteral), as in the appendix and the 2023/2024 transcriptions
  - CXM = `cefuroxime axetil` (oral)
  - CL = colistin (this edition prints **CL**, not CS)
  - CLR = clarithromycin, AMX = amoxicillin, PIP = piperacillin, FOX = cefoxitin, CFM = cefixime, ATM = aztreonam
  - The figures print LZD for linezolid, while the appendix spells it LNZ. The printed `LZD` is kept.
- AZM (azithromycin) and FOS (fosfomycin) have no column in this edition. The Shigella narrative says no reported isolate was tested against azithromycin.

## Method

The tables are **real vector text/graphics, not images** (Word export). The `pdftotext -layout` dump looks garbled because the columns are rotated and the cells are stacked. I parsed the PDF directly with pdfplumber, using a scratchpad script outside the repo:
- Rows and columns come from the drawn grid lines. Column codes come from the rotated header characters.
- Each cell's background fill was checked. Visible cells are white, fill 1.0. Suppressed cells are grey, fill 0.749/0.753.
- **Hidden layer in this edition:** the text layer also holds 943 suppressed cells (n ≤ 20 or not a CLSI-recommended combination). Their % and n are drawn in grey (0.749) on the grey background, so they are invisible in print. Examples: E. faecalis OX "21 (14)", Campylobacter spp. values. **Only cells with black text on a white background were transcribed.** Every black-text cell lies on white, and every white cell has black text: zero exceptions on all 20 pages.
- In one cell the hidden layer is faintly visible: p.57 (regional 續1), Campylobacter spp. × SXT shows a pale grey "0 / 1" (colour 0.588) on a grey cell. It is suppressed (n=1) and **not transcribed**.
- I viewed every one of the 20 page PNGs and compared it cell by cell with the parsed grid. All matched.
- Printing quirk: national Salmonella spp. × MI prints its isolate count as "142" without parentheses. Transcribed as 67% / 142.

## Validation

- 1470 rows. No duplicate (level, pathogen, abbr). susceptible_pct is 0–100. No empty fields.
- Minimum isolates = 21. This fits the method rule that results with a denominator < 20 are not shown. (The text says both "≤ 20" and "不足 20".)
- **Level-sum check:** for every pathogen × antibiotic present at all three hospital levels, MC + RH + DH isolates equal the national isolates exactly, with two exceptions. These look like inconsistencies in the source itself. Both values are kept as printed:
  - ABc × SXT: national (17,939) vs 6,789 + 8,831 + 2,313 = 17,933 (diff 6)
  - ABc × CL: national (11,276) vs 5,974 + 4,295 + 807 = 11,076 (diff 200; possibly a 2↔0 digit typo in one figure)

  Where a level is missing (suppressed), the sum of the levels shown never exceeds the national n.
- **Narrative cross-check** (printed pp.31–33): every percentage quoted matches the national table. Values checked:
  - S. aureus: OX 56, MI 86, VA/TGC/LZD/SYN 100
  - S. pneumoniae: P-G 68, FUR 30, CTX 69, CRO 82, FEP 39, ETP 98, MEM 21, IPM 28, LVX/MXF ≥ 90
  - E. coli: TZP 92, AMC 68, CFP 94, FEP 84, FOX 82, CIP/LVX < 60, carbapenems/TGC ≥ 97
  - K. pneumoniae: ATM 81, TZP 75, AMC 57, CFP 83, FEP 78, CIP 64, LVX 65, carbapenems 82–87, TGC 88
  - Salmonella: TE 88, MI 67, TZP 98, SAM 66, CFP 97, FEP 93, CIP 73, LVX 80, carbapenems 96–99
  - Shigella: C 74, CIP 52, 3rd GCs ≥ 89
  - ABc: TGC 70
  - P. aeruginosa: CIP 81, LVX 75, carbapenems 87–92
  - C. difficile: CC 30, MTZ 100
  - Enterococci: VA 99/44, penicillins ≥ 95 (E. faecalis) and < 10 (E. faecium)
- Values that look odd but are printed and kept:
  - Medical-center Shigella × CIP = 5% (n=41), against 52% nationally and 75% in regional hospitals
  - Regional ABc × VA = 100 (n=21)
  - District P. aeruginosa × VA 20 (n=30) and × LZD 83 (n=58)
  - Several OX/P-G/P-V cells for Gram-negatives are suppressed (hidden) and are not transcribed

Confidence: **high**. The values come from the PDF's own vector text, the background check confirms which cells are visible, the national figure ties out to the level figures, and every page was checked visually. No cells were unreadable.

## Methodology / comparability (from 壹、前言 and 五、資料分析方式說明)

- Source system: THAS AR module. Specimen dates 2017-01 to 2022-12. Data downloaded 2023-08-25 to 2023-09-30.
- Participating hospitals: 210 hospitals reported to the AR module at some point in 2017–2022. The number of reporting hospitals rose from 134 in 106 (2017) to 210 in 111 (2022), per 貳-一. 表 6 (PDF pp.118–125) lists the hospitals by level and year. The level labels there are not in the text layer, so per-level counts were not tallied.
- Antibiogram first-isolate rule: same hospital, same patient, same year, same species, same antibiotic. The first specimen date is used. If that date has several results, the priority is NS > R > I > SDD > S.
- % susceptible = S / tested × 100. Denominator < 20: not shown.
- Antibiotic selection follows *Antibiotics Essentials* (Ch. 3) plus the AR-system lab items. A combination is not shown if n ≤ 20 or if it is not a CLSI-recommended test, with exceptions for tigecycline and for H. pylori items (amoxicillin, levofloxacin, tetracycline, metronidazole).
- The methods text says colistin is excluded "from resistance-rate presentation", because CLSI now reports colistin only as I/R for Enterobacterales, Acinetobacter and P. aeruginosa. **The antibiogram nevertheless prints a CL column with % susceptible values.** They are transcribed as printed. Treat CL % susceptible with caution: under current CLSI there is no "S" category.
- Breakpoints: **no CLSI M100 edition/version is stated.** The report says each hospital's own reported S/I/R interpretations are used, and labs' identification ability, AST workflow and interpretive criteria differ (說明 2). Any breakpoint differences between hospitals carry straight into the antibiogram.
- Yersinia spp. were excluded from the analysis because too few isolates were reported.

## Layout differences vs the 2023/2024 (InDesign) editions

- 2022 is a Word document. Each antibiogram is **5 sub-tables (base + 續1–續4) per level**, giving 20 table pages in total. The level figures are 圖 3-1-2 (MC), 3-1-3 (RH) and 3-1-4 (DH).
- The tables are vector text, not raster images, and carry an invisible grey-on-grey layer of suppressed values. Naive text extraction (e.g. `pdftotext`) therefore mixes visible and suppressed numbers. Only the visible cells are valid.
- Header typo "4rd GCs". Colistin is coded CL. Clarithromycin (CLR), cefixime (CFM) and cefuroxime axetil (CXM) have their own columns. There are no AZM or FOS columns.
- Pathogen set: 20 rows, including Campylobacter spp. (all suppressed) and Helicobacter pylori. Enterobacter is shown as *E. cloacae*, while the counts chapter uses Enterobacter spp.
- Typos in printed captions (do not affect data): 圖 3-1-3（續 3）caption reads "區域醫院重臨床分離…", and the S. pneumoniae narrative writes "cephlosproin".
