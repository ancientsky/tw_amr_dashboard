# TW-AMR Watch · 臺灣抗藥性監測儀表板

**https://ancientsky.github.io/tw_amr_dashboard/**

[繁體中文](#繁體中文) · [English](#english) · 日本語 UI 対応

---

## 繁體中文

TW-AMR Watch 是一個互動式、多語（繁中／English／日本語）的靜態儀表板，呈現臺灣衛生福利部疾病管制署
年度監視報告中的**抗生素抗藥性（AMR）**、**抗生素使用量（AMU）**與**醫療照護相關感染（HAI）**資料，並與
WHO GLASS 進行國際比較。對象為感染管制人員、臨床微生物師、感染科醫師與醫院流行病學專家。

### 功能
- 互動圖表（Apache ECharts）：趨勢、菌種 × 抗生素熱圖、醫院層級比較、國際比較地圖
- 淺色／「黑綠」深色主題，跟隨系統設定；繁中為主要語言，英、日為完整翻譯
- 每張圖卡皆有工具列：全螢幕、資料表、下載 PNG（含標題、來源與浮水印）、下載 CSV、複製連結、分享
  （X／Threads／Facebook／LINE／裝置分享／Instagram 1080×1080 與 1080×1920 圖卡／複製嵌入碼）
- 所有篩選狀態都存在網址中，可直接分享深層連結
- 醫院網站可用一行 `<script>` 嵌入圖表（見 [docs/EMBED.md](docs/EMBED.md)）
- 開放資料：JSON／CSV 下載與靜態 API（見 [docs/API.md](docs/API.md)）
- 瀏覽器端 AMR 問答小幫手

### 頁面（HashRouter）
| 路徑 | 內容 |
|---|---|
| `#/` | 總覽：重點指標、趨勢、熱圖 |
| `#/resistance` | 抗藥性探索器：`view=trend`（多重抗藥菌趨勢）· `antibiogram`（敏感性圖譜）· `pathogen`（單一菌種）· `compare`（比較）· `isolates`（菌株數） |
| `#/antibiotic-use` | 抗生素使用量（類別、AWaRe） |
| `#/hai` | 醫療照護相關感染（感染密度、CLABSI/CAUTI/VAP、裝置使用率） |
| `#/international` | WHO GLASS 國際比較 |
| `#/data` | 資料下載、API 文件、嵌入產生器 |
| `#/resources` | 國際 AMR／AMU／HAI 儀表板與資源目錄 |
| `#/about` | 方法說明與資料來源 |
| `#/chat` | AMR 問答 |

網址參數範例：`#/resistance?phenotype=CRAB&level=medical_center&years=2018-2024&lang=en&theme=dark`

各頁可讀取的參數（所有頁面另支援 `lang=zh-TW|en|ja`、`theme=light|dark`，以及 `chart=<圖卡 id>`：開啟時自動捲動並標示該圖卡）：

| 頁面 | 參數 |
|---|---|
| `#/resistance` | `view`、`phenotype`（可逗號分隔最多 4 個）、`pathogen`、`antibiotic`、`level`、`setting`、`specimen`、`years`、`year`、`items`（compare）、`organism`／`scope`（isolates） |
| `#/international` | `indicator`、`countries`、`region`、`year`、`bars` |
| `#/antibiotic-use` | `level`、`metric`、`classes`、`years` |
| `#/hai` | `level`、`icu`、`metric`、`years`、`site` |
| `#/resources` | `q`、`cat`、`region`、`view` |

### 資料來源與暫定資料說明
- **抗藥性（`resistance.json`）與菌株數（`isolates.json`）**：轉錄自使用者提供的三份《臺灣抗生素抗藥性監視年報》
  （2022、2023、2024 年版，資料年 2017–2024，PDF 位於 `raw/`）。每筆資料都有 `precision` 欄位：
  `table`（表格精確值）、`text`（內文引用）、`chart_estimate`（由圖表判讀，約 ±1–2 個百分點），介面會以標籤標示。
  同一資料年若出現在多個年版，前端以「精確度較高者優先，其次為較新年版」去重。
- **抗生素使用量、醫療照護相關感染、國際比較（`antibiotic_use`、`hai`、`hai_pathogens`、`glass`）**：
  尚未取得對應年報，為依已發表趨勢建模之**暫定估計值**（`provisional: true`）。相關圖卡會顯示「暫定」標籤，
  頁面上方會顯示提示。**請勿將暫定數值作為官方數據引用。**
- 本網站為獨立專案，非疾管署或 WHO 官方出版品，亦不構成醫療建議。

<a id="adding-reports"></a>

### 如何加入年報 PDF
1. 將 PDF 放入儲存庫根目錄的 `raw/`，檔名須保留西元年，例如：
   - `raw/臺灣抗生素抗藥性監視年報(2025年).pdf`
   - `raw/臺灣抗生素使用量監視年報(2024年).pdf`
   - `raw/醫療照護相關感染監視年報(2024年).pdf`
2. 推送到 GitHub；`.github/workflows/ingest.yml` 會重新產生 `public/data/` 與 `public/api/v1/`。
   本機可執行 `bash scripts/ingest/run_all.sh`（需 Python 3 與 pdfplumber）。
3. 詳細流程見 [data/source/README.md](data/source/README.md)、[docs/DATA.md](docs/DATA.md) 與
   [docs/TRANSCRIPTION.md](docs/TRANSCRIPTION.md)。資料集的 `provisional` 旗標轉為 `false` 後，暫定提示即自動消失。

### 開發
需求：Node 22、npm。

```bash
npm ci
npm run dev        # http://localhost:5173/tw_amr_dashboard/
npm run build      # tsc + vite build → dist/（index.html + embed.html）
npm run preview    # 預覽 dist/
npm run lint       # eslint
npm test           # vitest（資料選擇器、格式、i18n、調色盤、分享連結）
npm run typecheck
npm run build && node scripts/screenshot.mjs   # Playwright 截圖：各頁 × 淺／深 × 三語 → screenshots/
```

`public/data/*.json` 不存在時，開發模式會自動改用 `src/data/fixtures/` 的小型測試資料（圖卡顯示「開發測試資料」）。
推送到 `main` 會由 `.github/workflows/deploy.yml` 建置並部署到 GitHub Pages。

### 嵌入圖表
```html
<script src="https://ancientsky.github.io/tw_amr_dashboard/embed.js"
        data-chart="resistance-trend" data-pathogen="KPN" data-antibiotic="MEM"
        data-lang="zh-TW" data-theme="light" async></script>
```
可用圖表：`resistance-trend`、`resistance-heatmap`、`kpi-strip`、`resistance-co-ho`、`resistance-pathogen-bars`、
`glass-map`、`glass-bars`、`amu-stacked`、`amu-aware`、`hai-trend`、`hai-bump`（後六者為暫定資料，圖卡會標示）。
iframe 會以 `postMessage`（`twamr:resize`）自動調整高度；每張圖卡的「分享 → 複製嵌入碼」可產生目前檢視的程式碼。
完整說明見 [docs/EMBED.md](docs/EMBED.md)。

### API
靜態 JSON／CSV API：`https://ancientsky.github.io/tw_amr_dashboard/api/v1/`（[docs/API.md](docs/API.md)、
[openapi.yaml](https://ancientsky.github.io/tw_amr_dashboard/api/v1/openapi.yaml)）。GitHub Pages 允許跨來源存取（CORS）：

```js
const base = 'https://ancientsky.github.io/tw_amr_dashboard/api/v1/';
const crkp = await (await fetch(base + 'resistance/phenotype/CRKP.json')).json();
console.log(crkp.records.filter((r) => r.level === 'all' && r.setting === 'all').map((r) => [r.year, r.resistant_pct]));
```
其他路徑：`index.json`（目錄）、`<dataset>.json|.csv`、`resistance/pathogen/{CODE}.json`、`resistance/year/{YYYY}.json`、
`glass/indicator/{CODE}.json` 等；`#/data` 頁面內建 API 試用器。

### 品質檢查
`npm run build && node scripts/qa.mjs`：以 Playwright 逐頁（三語 × 淺／深）檢查主控台錯誤、未翻譯鍵值、`<html lang>`／標題、
每頁單一 h1、手機寬度（360px）水平溢位，以及所有嵌入圖表的 `twamr:resize` 訊息。

---

## English

TW-AMR Watch is an interactive, multilingual (Traditional Chinese / English / Japanese) static dashboard of Taiwan's
national **antimicrobial resistance**, **antibiotic use** and **healthcare-associated infection** surveillance (Taiwan CDC
annual reports, THAS / TNIS), with an international comparison against WHO GLASS. It is built for infection-control
teams, clinical microbiologists, ID physicians and hospital epidemiologists.

**Highlights:** ECharts visualisations · light and "black-green" dark themes · every chart card has fullscreen, data
table, branded PNG, CSV, copy-link and share (X, Threads, Facebook, LINE, Web Share, Instagram cards, embed code) ·
URL-addressable state · one-line hospital embeds · open JSON/CSV static API · in-browser AMR assistant.

**Routes:** `#/` overview · `#/resistance` (explorer: `view=trend|antibiogram|pathogen|compare|isolates`) ·
`#/antibiotic-use` · `#/hai` · `#/international` · `#/data` (downloads, API, embed builder) · `#/resources` ·
`#/about` (methodology) · `#/chat`. All state lives in the hash query, e.g.
`#/resistance?phenotype=CRKP&setting=ho&years=2019-2024`; every page also accepts `lang`, `theme` and `chart=<card id>`
(scrolls to and highlights that card). The per-page parameter list is in the table in the Chinese section above.

### Data provenance
- `resistance.json` and `isolates.json` are **transcribed from the three Taiwan CDC AMR annual reports** supplied in `raw/`
  (2022/2023/2024 editions, data years 2017–2024). Each record carries `precision` (`table` exact, `text` quoted,
  `chart_estimate` read from a printed chart, ≈ ±1–2 pts), shown as a badge in the UI. When a data year appears in several
  editions the UI keeps the most precise value, then the newest edition.
- `antibiotic_use`, `hai`, `hai_pathogens` and `glass` are **provisional estimates** modelled on published trends
  (`provisional: true`) until the corresponding reports are added; those cards show a *Provisional* chip and those pages a
  notice. Do not cite provisional values as official.
- Independent project — not an official Taiwan CDC or WHO publication, not medical advice.

### Adding report PDFs
Drop PDFs into `raw/` keeping the CE year in the file name (e.g. `raw/臺灣抗生素使用量監視年報(2024年).pdf` for antibiotic use,
`raw/醫療照護相關感染監視年報(2024年).pdf` for HAI), push, and the ingest workflow regenerates `public/data/` and
`public/api/v1/` (locally: `bash scripts/ingest/run_all.sh`). Once a dataset's
`provisional` flag turns `false` its provisional chips and notices disappear automatically. See
[data/source/README.md](data/source/README.md), [docs/DATA.md](docs/DATA.md) and [docs/TRANSCRIPTION.md](docs/TRANSCRIPTION.md).

### Development
```bash
npm ci && npm run dev    # http://localhost:5173/tw_amr_dashboard/
npm run build            # dist/ with index.html + embed.html
npm run lint && npm test
npm run build && node scripts/screenshot.mjs   # smoke screenshots (routes × light/dark × 3 languages)
```
Stack: Vite 5 · React 18 · TypeScript (strict) · react-router HashRouter · Apache ECharts 5 · framer-motion · CSS Modules +
design tokens. Architecture and shared contracts: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Embeds
```html
<script src="https://ancientsky.github.io/tw_amr_dashboard/embed.js"
        data-chart="resistance-trend" data-pathogen="KPN" data-antibiotic="MEM"
        data-lang="en" data-theme="light" async></script>
```
11 charts can be embedded (`resistance-trend`, `resistance-heatmap`, `kpi-strip`, `resistance-co-ho`,
`resistance-pathogen-bars`, `glass-map`, `glass-bars`, `amu-stacked`, `amu-aware`, `hai-trend`, `hai-bump`); the iframe
auto-resizes via `postMessage` (`twamr:resize`). Every card's **Share → Copy embed code** generates the snippet for the
current view. Details: [docs/EMBED.md](docs/EMBED.md).

### API
Static, CORS-enabled JSON/CSV at `https://ancientsky.github.io/tw_amr_dashboard/api/v1/` ([docs/API.md](docs/API.md),
[openapi.yaml](https://ancientsky.github.io/tw_amr_dashboard/api/v1/openapi.yaml)):

```bash
curl -s https://ancientsky.github.io/tw_amr_dashboard/api/v1/resistance/phenotype/CRAB.json | jq '.records[0]'
curl -sO https://ancientsky.github.io/tw_amr_dashboard/api/v1/resistance.csv
```
`#/data` has a live API explorer, a downloads grid for every dataset and the embed builder.

### Quality checks
`npm run build && node scripts/qa.mjs` drives Playwright over every route (3 languages × light/dark) and fails on console
errors, raw i18n keys, wrong `<html lang>`/title, ≠ 1 `<h1>`, horizontal overflow at 360 px, or an embed that never posts
`twamr:resize`.

### License
Code: MIT. Data: subject to the terms of the original sources (Taiwan CDC, WHO GLASS).
