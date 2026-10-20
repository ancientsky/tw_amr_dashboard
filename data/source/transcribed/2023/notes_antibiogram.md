# 2023 report: antibiogram.csv notes (圖 3-1-1 to 圖 3-1-4)

Source: 臺灣抗生素抗藥性監視年報 2023, section 參-一 「臨床分離菌株抗生素敏感性圖譜」. Data year 2023 (ROC 112).
report_year=2023, data_year=2023. Printed page = PDF page - 9 (checked against the page footers).

| level | figure | PDF pages | printed pages | rows |
|---|---|---|---|---|
| all (全國) | 圖 3-1-1 (+續1-4) | 42-46 | 33-37 | 441 |
| medical_center (醫學中心) | 圖 3-1-2 (+續1-4) | 47-51 | 38-42 | 382 |
| regional (區域醫院) | 圖 3-1-3 (+續1-4) | 52-56 | 43-47 | 409 |
| district (地區醫院) | 圖 3-1-4 (+續1-4) | 57-61 | 48-52 | 374 |
| **total** | | | | **1606** |

## Pathogens (27, printed Latin names)
- Aerobic Gram positive: Enterococcus faecalis, Enterococcus faecium, Group A Streptococci, Group B Streptococci, Staphylococcus aureus, Streptococcus pneumoniae
- Aerobic Gram negative, Enterobacterales: Citrobacter spp., Enterobacter cloacae, Escherichia coli, Klebsiella pneumoniae, Morganella spp., Non-typhoidal Salmonella, Proteus mirabilis, Providencia spp., Serratia marcescens, Shigella spp.
- Aerobic Gram negative, other: Acinetobacter baumannii, Burkholderia cepacia complex, Chryseobacterium indologenes, Elizabethkingia spp., Haemophilus influenzae, Helicobacter pylori, Neisseria gonorrhoeae, Pseudomonas aeruginosa, Stenotrophomonas maltophilia
- Anaerobes: Bacteroides fragilis, Clostridioides difficile

Rows that are printed but entirely blank, so they have no CSV rows: Shigella spp. at district (地區醫院) level on all its pages; Helicobacter pylori at regional and district levels.

## Method
- These table pages are vector PDF, not raster. The digits are a real text layer. Each word was pulled out with its coordinates (pdfplumber) from `raw/臺灣抗生素抗藥性監視年報(2023年).pdf`. Each one was placed in a row and column using the drawn table grid lines. The big number is % susceptible and the small number is isolates tested.
- Antibiotic classes come from the header boxes that the full-height grid lines bound.
- Checks:
  - No number in any table was left unassigned to a cell.
  - Every cell with a value has both % and n.
  - Pixel test on the 150-dpi renders: every kept cell has dark glyph pixels, and every cell treated as empty or hidden has none.
  - Visual comparison against the PNGs for pp.42, 46 and 59.
  - All quoted percentages in the narrative on printed pp.30-32 match: E. faecalis/E. faecium VA 99/48; S. aureus OX 55, MI 95; S. pneumoniae P-G 71, CRO 88, FUR 6, FEP 35, ETP 95, MEM 17, IPM 40; E. coli TZP 89, AMC 63, CFP 93, FEP 82, FOX 80; K. pneumoniae TE 77, TZP 70, CIP=LVX 63, TGC 89; NTS AM 60, CRO 88, CTX 82, CIP 67, LVX 75; Shigella SXT 76, CIP 63; A. baumannii MI 81, TGC 70; P. aeruginosa CIP 81, LVX 75; C. difficile CC 27, MTZ 100.
- **Hidden (grey) cells were excluded.** Under the report's display rules (前言 p.4-5 and p.10), a value is not shown when n < 20 or when the agent is not CLSI-recommended for that organism. Tigecycline is always shown, and so are the H. pylori agents. In the PDF these suppressed cells still hold numbers, but the text is filled in the same grey as the cell background (0.749 or 0.753), so nothing is visible. There are 429 such hidden values: all 124, medical_center 85, regional 111, district 109. They are NOT in the CSV, because the printed figure shows those cells as empty. They are kept for reference only in the scratchpad: `hidden_gray_cells.csv`. Every visible cell has n >= 20, which agrees with the rule.
- Unreadable cells: none.

## Labels
- antibiotic_abbr is verbatim as printed. LZD is printed as LZD, while the report's own appendix uses LNZ.
- antibiotic: generic names taken from the report's 附錄 2 abbreviation table. Two to note: FUR = cefuroxime (sodium) and CXM = cefuroxime axetil. Both appear under 2nd GCs. Other codes beyond the brief: FOX cefoxitin, CFM cefixime, AMX amoxicillin, PIP piperacillin, CLR clarithromycin, ATM aztreonam, MTZ metronidazole.
- antibiotic_class: the group header as printed, with these fixes:
  - Words broken across lines are rejoined ("Macroli/des", "Tetracy/clines", "Anti-/Pseudom/onal", "Miscella/neous (II)").
  - The misprint **"4rd GCs" is normalized to "4th GCs"**.
  - In the anaerobe tables, the CFP header is truncated to "Anti-Pseudomonal" and is recorded as "Anti-Pseudomonal 3rd GCs", matching the CFP/CAZ header elsewhere.
  - Classes used: Penicillins, Anti-Pseudomonal Penicillins, Macrolides, Tetracyclines, Miscellaneous (I), 1st GC, 2nd GCs, 3rd GCs, Anti-Pseudomonal 3rd GCs, 4th GCs, Aminoglycosides, Fluoroquinolones, Carbapenems, Miscellaneous (II). ATM and TGC fall under Miscellaneous (II).
- figure: the base figure number (e.g. `圖 3-1-1`), also used for the 續 pages. pdf_page gives the exact page.

## Methodology (前言)
- Data: THAS AR module. Specimens collected Jan 2018 to Dec 2023 (107-112). Data downloaded 2024-09-05 to 09-30.
- Hospitals reporting to the AR module, 107-112 in total: 295. Hospitals reporting in each year rose from 159 (107) to 295 (112), per 貳 p.14. A count per hospital level is not stated in the text. Table 6 lists hospitals by year but not by level.
- Antibiogram de-duplication: the first isolate per hospital, patient, year, species and antibiotic. If one collection date has more than one result, the worst result is taken in the order NS > R > I > SDD > S.
- %S = S / tested × 100. Not shown when the denominator is < 20, or when the agent is not CLSI-recommended for that organism. Exceptions: tigecycline, and amoxicillin, levofloxacin, tetracycline and metronidazole for H. pylori. Colistin is excluded for Enterobacterales, Acinetobacter and P. aeruginosa. For S. pneumoniae, meningitis and non-meningitis breakpoints are not separated, because results are used as reported by hospitals; CSF is about 0.3% of isolates.
- **CLSI version / breakpoint edition: not specified in the 2023 report.** Interpretations (S/I/R) are taken as reported by each hospital laboratory, so breakpoint versions may differ between hospitals and over time.

## Confidence
High. Values come from the PDF's own text layer. Their visibility was checked against the rendered pixels, and they agree with every narrative figure checked. The main judgement calls are listed above: excluding the grey-hidden values, and normalizing class labels.
