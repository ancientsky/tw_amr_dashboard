# 2024 report — antibiogram.csv notes (圖 3-1-1 … 3-1-4, 113 年 = data year 2024)

Source: 臺灣抗生素抗藥性監視年報 2024, 參-一「臨床分離菌株抗生素敏感性圖譜」.
Printed pp.33–52 = PDF pp.41–60 (printed N = PDF N+8).

| figure | level | printed pp. | PDF pp. | rows |
|---|---|---|---|---|
| 圖 3-1-1 全國 | `all` | 33–37 | 41–45 | 436 |
| 圖 3-1-2 醫學中心 | `medical_center` | 38–42 | 46–50 | 414 |
| 圖 3-1-3 區域醫院 | `regional` | 43–47 | 51–55 | 453 |
| 圖 3-1-4 地區醫院 | `district` | 48–52 | 56–60 | 411 |
| **total** | | | | **1,714** |

## Method
- These figures are vector graphics: every number is in the PDF text layer. Cells were pulled out with pdfplumber
  using character coordinates, then assigned to rows and columns using the drawn grid lines. Column codes come from
  the rotated header characters. Each class header was assigned from the header-band group borders, plus a text-position
  split in the two places where a border is not drawn (PDF p.41 Carbapenems | Miscellaneous (II); p.45 Penicillins | Anti-Pseudomonal Penicillins).
- **Hidden (suppressed) cells were excluded.** Grey cells still carry numbers in the text layer, printed in the same grey
  (DeviceGray-like 0.247/0.251) as the cell fill, so they cannot be seen on the page. There are 405 such cells, e.g. national
  E. faecalis OX 45/29 and NTS TZP 96/788. This matches the 前言 rule: n<20, or the drug is not CLSI-recommended for the organism, is 不予呈現.
  The filter was exact: every visible (black-text) value sits on a white cell, and every grey-text value sits on a grey cell.
- All 20 page PNGs (150 dpi) were then checked visually against a rebuilt grid. Every cell matched; no digit discrepancies were found.
- Cross-checked against the narrative on printed pp.30–32: all 33 values quoted there match. Examples: E. faecium VA 52; S. aureus OX 53, MI 95;
  S. pneumoniae P-G 68, CRO 85, FUR 19, FEP 40, IPM 48, MEM 12; E. coli TZP 87, AMC 64, CFP 92, FEP 80; K. pneumoniae TE 56, TZP 69, SAM 55, CIP/LVX 64,
  TGC 90; NTS AM 51, CRO 82, CTX 76, CIP 61, LVX 68; Shigella SXT 60, CIP 35; A. baumannii TGC 77, MI 80; P. aeruginosa CIP 80, LVX 75;
  C. difficile MTZ 99.
- Validation: header exact, 0 ≤ % ≤ 100, isolates all present (min 21, consistent with the n≥20 display rule), no duplicate (level, pathogen, abbr).

## Unreadable cells
None. Every visible cell was read from the text layer and confirmed visually.

## Pathogens (27)
Gram positive: Enterococcus faecalis, Enterococcus faecium, Group A Streptococci, Group B Streptococci, Staphylococcus aureus, Streptococcus pneumoniae.
Enterobacterales: Citrobacter spp., Enterobacter cloacae, Escherichia coli, Klebsiella pneumoniae, Morganella spp., Non-typhoidal Salmonella,
Proteus mirabilis, Providencia spp., Serratia marcescens, Shigella spp.
Non-Enterobacterales: Acinetobacter baumannii, Burkholderia cepacia complex, Chryseobacterium indologenes, Elizabethkingia spp.,
Haemophilus influenzae, Helicobacter pylori, Neisseria gonorrhoeae, Pseudomonas aeruginosa, Stenotrophomonas maltophilia.
Anaerobes: Bacteroides fragilis, Clostridioides difficile.
Pathogens per level: all 27, medical_center 27, regional 26 (H. pylori row all grey), district 24 (H. pylori, Shigella spp. and
C. difficile rows all grey).

## Abbreviations and classes
- Generic names follow the report's 附錄 2 (抗生素名稱與簡稱對照表): FUR = cefuroxime sodium (parenteral), CXM = cefuroxime axetil (oral),
  CFM = cefixime, AMX = amoxicillin, CLR = clarithromycin, HLG = gentamicin high-level ("high-level gentamicin"), SXT = TMP-SMX.
- 45 distinct codes are used. Codes in this edition that are not in the brief's list: AMX, CLR, CFM, CXM (also in appendix), CZ (cefazolin),
  FOX, MTZ, PIP, ATM.
- antibiotic_class contains the printed header with its line-wrap hyphenation joined (e.g. "Macroli/des" → Macrolides, "Aminoglycosid/es",
  "Carbape/nems", "Miscell/aneous (II)", "Anti-/Pseudom/onal/Penicilli" → Anti-Pseudomonal Penicillins).
  **The printed header "4rd GCs" (a typo) is normalised to `4th GCs`.** "1st GC" is kept as printed (singular).
  Classes used: Penicillins, Anti-Pseudomonal Penicillins, Macrolides, Tetracyclines, Miscellaneous (I), 1st GC, 2nd GCs, 3rd GCs,
  Anti-Pseudomonal 3rd GCs, 4th GCs, Aminoglycosides, Fluoroquinolones, Carbapenems, Miscellaneous (II).
- The same code can sit in different class blocks on different pages, as printed. Examples: CAZ under "Anti-Pseudomonal 3rd GCs";
  N. gonorrhoeae P-G/P-V under Penicillins; FOX under 2nd GCs (in the S. aureus/E. faecium regional block and for anaerobes).

## Source oddities (transcribed as printed, not corrected)
- **Bacteroides fragilis, medical_center (PDF p.50) is cell-for-cell identical to the national table (PDF p.45)** (1/588, 0/377, 66/1594 …).
  This is probably a copy error in the report. The regional and district values differ.
- Level isolate counts summed over the three levels exceed the national count for 17 pathogen×drug pairs. These are mainly
  Elizabethkingia spp. (e.g. GM national n=422 but medical_center n=689) and B. fragilis (a consequence of the duplicated block above).
  Also Group A Streptococci C (national 40 vs regional 76 + district 24) and NTS CRO (+9). Use the level tables with caution for these.
- Some values are printed even though they look clinically non-standard. Examples: P. aeruginosa SAM/MI/SXT/CTX/CRO/CFM/ETP at
  medical_center and regional; E. faecalis GM/FEP/MI at medical_center; E. faecium DAP 5% at medical_center (hidden nationally);
  Proteus/Morganella/Providencia TGC 1–4%. They are kept because they are printed.
- Placement differs between pages: E. faecalis "57/23" is under C nationally but under SXT for medical_center.

## Breakpoint / methodology notes (前言, printed pp.4–5, 8, 10)
- The CLSI version used is **not stated**. The report says results "根據各醫院通報之檢測結果進行分析": hospital-reported S/I/R interpretations, not re-interpreted centrally.
- Antibiotic selection: drugs follow Antibiotics Essentials (Ch.3) and AR-system lab items. A drug is not shown if n ≤ 20 (the computation
  rule says denominator < 20), or if CLSI does not recommend testing it for the organism. Exceptions: tigecycline (key MDRO drug), and amoxicillin,
  levofloxacin, tetracycline and metronidazole for H. pylori — these are shown but flagged 建議應保守判讀.
- Colistin is excluded for Enterobacterales, Acinetobacter spp. and P. aeruginosa, because CLSI now allows only I/R reporting.
- S. pneumoniae: meningitis vs non-meningitis criteria depend on the hospital report; CSF made up about 0.3% of S. pneumoniae isolates in 113 年.
  Oxacillin may be used as an aid for penicillin resistance.
- Burkholderia cepacia complex, and P. aeruginosa vs gentamicin: CLSI gives no R/I/S criteria, so the values are the hospital-reported interpretations.
- Dedup rule (歸人): first isolate per hospital/patient/year/species/antibiotic. If one date has several results, the priority is
  NS > R > I > SDD > S. Denominator = isolates with an AST result for that organism–drug pair; numerator = S. % susceptible = S/n×100.
- Yersinia spp. is not analysed (too few isolates). Data period 108–113 年 (sample dates); 329 hospitals reported to AR 108–113;
  data downloaded 114/9/1–9/19.
- In the 3-2 resistance section, daptomycin counts only R (not SDD/I) for VRE. This does not affect the 3-1 susceptibility tables.

## Confidence
High. Values were taken from the vector text layer, the suppression filter was checked against cell fills, and all 20 pages were
compared visually to the printed images, with zero mismatches. Residual risk is limited to the class-label normalisation
choices above ("4rd"→"4th", joined hyphenation).
