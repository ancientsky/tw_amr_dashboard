# Source data / 原始資料

## 繁體中文

### 已提供（抗藥性年報）
三份衛生福利部疾病管制署《臺灣抗生素抗藥性監視年報》PDF 位於儲存庫根目錄的 **`raw/`**：

| 檔名 | 年版 | 資料年 |
|---|---|---|
| `raw/台灣抗生素抗藥性監視年報2022年.pdf` | 2022 | 2017–2022（民國 106–111） |
| `raw/臺灣抗生素抗藥性監視年報(2023年).pdf` | 2023 | 2018–2023（民國 107–112） |
| `raw/臺灣抗生素抗藥性監視年報(2024年).pdf` | 2024 | 2019–2024（民國 108–113） |

報告年份由檔名中的西元年（`2022`…）判斷，新增年版時請在檔名保留西元年。

### 資料流程
1. **文字層表格**（貳、表 2-x 菌株數）：`scripts/ingest/parse_isolate_tables.py raw/*.pdf` 直接解析 PDF 文字層，
   產生 `transcribed/<年版>/isolate_counts.csv`（精確數值，並驗證各表合計）。
2. **圖表**（敏感性圖譜 圖 3-1-x、抗藥性長條圖 圖 3-2-x、多重抗藥菌趨勢 圖 4-x-y）：依 `docs/TRANSCRIPTION.md`
   轉錄為 `transcribed/<年版>/{antibiogram,pathogen_resistance,mdro_trends,mdro_counts}.csv`。
   敏感性圖譜為向量圖，數值可由文字層取得（精確）；長條圖／折線圖之數值為目視判讀，約有 ±1–2 個百分點誤差，
   並以 `read_method` 標示。
3. `python3 scripts/build_data.py`：執行 `scripts/ingest/map_amr.py`（轉錄 CSV → `data/curated/resistance.csv`、`isolates.csv`），
   驗證後輸出 `public/data/` 與 `public/api/v1/`。

### 尚未提供
《臺灣抗生素使用量監視年報》與《醫療照護相關感染監視年報》（TNIS）尚未提供，相關資料集為**暫定估計**。
取得後請放入 `raw/`（檔名需含「使用量」或「感染」及西元年，例如 `raw/臺灣抗生素使用量監視年報(2024年).pdf`、
`raw/醫療照護相關感染監視年報(2024年).pdf`），再執行 `bash scripts/ingest/run_all.sh`；
`map_amu.py`／`map_hai.py` 為骨架程式，需依實際表格版面調整（見程式內 TODO）。

### 其他資料夾
- `transcribed/<年版>/`：轉錄 CSV 與 `notes*.md`（轉錄方法、信心程度、原始報告之異常）。
- `extracted/`：`scripts/ingest/extract_tables.py` 的通用 pdfplumber 表格與文字輸出（輔助用，可重新產生）。

## English

### Supplied (AMR annual reports)
The three Taiwan CDC *Antimicrobial Resistance Surveillance Annual Report, Taiwan* PDFs live in **`raw/`** at the repo root
(2022, 2023 and 2024 editions; data years 2017–2024). The report year is taken from the 4-digit CE year in the file name,
so keep it when adding a new edition.

### Pipeline
1. **Text-layer tables** (section 2, 表 2-x isolate counts): `scripts/ingest/parse_isolate_tables.py raw/*.pdf` parses
   the PDF text layer into `transcribed/<edition>/isolate_counts.csv` (exact; every table is checked against its printed total).
2. **Figures** (antibiograms 圖 3-1-x, resistance bar charts 圖 3-2-x, MDRO trends 圖 4-x-y) are transcribed into
   `transcribed/<edition>/{antibiogram,pathogen_resistance,mdro_trends,mdro_counts}.csv` following `docs/TRANSCRIPTION.md`.
   Antibiograms are vector graphics, so their numbers come from the text layer (exact). Bar and line chart values are read by eye
   (≈ ±1–2 percentage points) and flagged through `read_method`.
3. `python3 scripts/build_data.py` runs `scripts/ingest/map_amr.py` (transcriptions → `data/curated/resistance.csv`, `isolates.csv`),
   validates everything and writes `public/data/` and `public/api/v1/`.

### Not yet supplied
The antimicrobial-use report (臺灣抗生素使用量監視年報) and the HAI/TNIS report (醫療照護相關感染監視年報) have not been supplied,
so those datasets are **provisional estimates**. To replace them, drop the PDFs into `raw/` with `使用量` / `感染` and the CE year
in the file name, for example `raw/臺灣抗生素使用量監視年報(2024年).pdf`, then run `bash scripts/ingest/run_all.sh`.
`map_amu.py` and `map_hai.py` are skeletons: adapt their TODO hooks to the real table layouts. A dataset only becomes non-provisional
when its mapper records `status: "ingested"` in `data/curated/_provenance.json` and no `origin=model` rows remain.
