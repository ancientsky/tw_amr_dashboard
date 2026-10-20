# Taiwan AMR Dashboard — Architecture & Shared Contract

> Single source of truth for every agent working on this repo. Read fully before touching code.
> Site name: **TW-AMR Watch**  (中文：臺灣抗藥性監測儀表板 / 日本語：台湾AMRサーベイランス・ダッシュボード)
> Repo: github.com/ancientsky/tw_amr_dashboard  → GitHub Pages at https://ancientsky.github.io/tw_amr_dashboard/

## 1. Goal
An interactive, visually striking, multilingual (zh-TW / en / ja) static dashboard presenting Taiwan's national
antimicrobial-resistance (AMR) surveillance (Taiwan CDC annual reports: 抗生素抗藥性監視年報、抗生素使用量監視年報、
醫療照護相關感染監視年報 — THAS / TNIS systems), with international comparison against WHO GLASS,
downloadable data + a static JSON "API", embeddable widgets for hospitals, a client-side AMR Q&A chatbot,
share-to-social chart cards, and a curated directory of international AMR / AMU / HAI dashboards.
Audience: infection-control professionals, clinical microbiologists, ID physicians, hospital epidemiologists.

## 2. Tech stack (fixed — do not substitute)
- Vite 5 + React 18 + TypeScript (strict). Package manager: npm. Node 22.
- Routing: `react-router-dom` **HashRouter** (GitHub Pages has no server rewrites). `vite.config.ts` → `base: '/tw_amr_dashboard/'`.
- Charts: **Apache ECharts 5** via `echarts` (import * as echarts from 'echarts'; use `echarts/core` tree-shaking is optional). One shared wrapper: `src/components/chart/EChart.tsx` (handles theme, resize, loading, toolbar).
- Maps: `world-atlas` (countries-110m) + `topojson-client`, registered with `echarts.registerMap('world', geojson)`.
- Motion: `framer-motion`. Numbers: `@number-flow/react` is NOT used; use our own `AnimatedNumber` (requestAnimationFrame).
- State: React context + hooks only (`src/app/providers/*`). No redux/zustand.
- Styling: plain CSS Modules + CSS custom properties (design tokens in `src/styles/tokens.css`). **No Tailwind.**
- i18n: our own tiny hook `useT()` (`src/i18n/`), dictionaries `src/i18n/zh-TW.json`, `en.json`, `ja.json` with dot-keys. All UI text goes through `t('key')`. Never hard-code visible strings.
- Fonts: `@fontsource-variable/inter` (Latin) + system CJK stack. No Google Fonts at runtime.
- Images for sharing: `html-to-image` (npm) + ECharts `getDataURL`.
- Tests: `vitest` for data utils; Playwright (preinstalled chromium at /opt/pw-browsers, do NOT run `playwright install`) for smoke screenshots in `scripts/screenshot.mjs`.
- Lint/format: eslint (flat config) + prettier. `npm run build` must pass with zero TS errors.

## 3. Repository layout (ownership → prevents merge conflicts)
```
/
├─ .github/workflows/deploy.yml        # build + deploy to Pages (actions/deploy-pages)
├─ .github/workflows/ingest.yml        # regenerate data when PDFs land in data/source/
├─ index.html                          # main app entry
├─ embed.html                          # embeddable widget entry (second Vite input)
├─ public/
│  ├─ data/                            # GENERATED canonical JSON (see §4) — owned by data pipeline
│  ├─ api/v1/                          # GENERATED static API (JSON+CSV+openapi.yaml) — owned by data pipeline
│  ├─ embed.js                         # iframe loader script hospitals paste into their sites
│  ├─ og/                              # social preview images
│  └─ favicon.svg, manifest.webmanifest
├─ data/
│  ├─ source/transcribed/<year>/       # CSVs transcribed from raw/*.pdf (docs/TRANSCRIPTION.md)
├─ raw/                                 # the user's Taiwan CDC annual-report PDFs (do not rename)
│  ├─ curated/*.json|csv               # hand-curated inputs (GLASS comparison, links, glossary, KB)
│  └─ schema/*.schema.json             # JSON Schemas for every dataset
├─ scripts/
│  ├─ ingest/                          # Python: pdf → curated tables (pdfplumber), per-report extractors
│  ├─ build_data.py                    # curated → public/data/*.json + public/api/v1/*  (idempotent)
│  └─ screenshot.mjs                   # Playwright smoke screenshots (light/dark × 3 langs)
├─ src/
│  ├─ main.tsx, app/App.tsx, app/routes.tsx, app/providers/{Theme,Locale,Data}Provider.tsx
│  ├─ styles/{tokens.css,global.css,themes.css}
│  ├─ i18n/{index.ts,zh-TW.json,en.json,ja.json}
│  ├─ data/{types.ts,load.ts,select.ts,format.ts}   # typed loaders & selectors over public/data
│  ├─ components/
│  │   ├─ layout/{Shell,TopNav,SideNav,Footer,LangSwitch,ThemeToggle,ProvisionalBanner}
│  │   ├─ chart/{EChart,ChartCard,ChartToolbar,useChartTheme,palette.ts}
│  │   ├─ share/{ShareMenu,ShareCardRenderer}       # PNG/copy/WebShare/X/FB/Threads/LINE/IG cards
│  │   └─ ui/{Kpi,AnimatedNumber,Badge,Tabs,Select,RangeSlider,DataTable,EmptyState,Skeleton}
│  ├─ features/
│  │   ├─ overview/        # route "/"
│  │   ├─ resistance/      # route "/resistance"
│  │   ├─ antibiotic-use/  # route "/antibiotic-use"
│  │   ├─ hai/             # route "/hai"
│  │   ├─ international/   # route "/international"
│  │   ├─ data-api/        # route "/data"   (downloads, API docs, embed builder)
│  │   ├─ resources/       # route "/resources"
│  │   ├─ methodology/     # route "/about"
│  │   └─ chatbot/         # floating widget + route "/chat"
│  └─ embed/               # entry for embed.html: renders a single ChartCard from URL params
└─ docs/ARCHITECTURE.md (this file), docs/DATA.md, docs/API.md, docs/EMBED.md
```

## 4. Canonical data contract (`public/data/*.json`) — ALL consumers code against `src/data/types.ts`
All numbers are plain JSON. Every dataset file has an envelope:
```ts
interface Envelope<T> { dataset: string; version: string; generatedAt: string; provisional: boolean;
  sources: SourceRef[]; notes?: LocalizedText; dims?: Record<string, Dim[]>; records: T[] }
type LocalizedText = { 'zh-TW': string; en: string; ja: string }
interface SourceRef { id: string; title: LocalizedText; publisher: string; year: number; url?: string; kind: 'annual-report'|'open-data'|'glass'|'curated' }
interface Dim { code: string; name: LocalizedText; group?: string; order?: number; meta?: Record<string, unknown> }
```
Datasets:
1. `meta.json` — site-level: `{ latestYear, yearsAvailable, provisional, sources[], ingestion: {status:'provisional'|'ingested', pdfs:[...]}, lastBuild }`
2. `resistance.json` — `ResistanceRecord { year; pathogen; antibiotic; phenotype?; level: 'all'|'medical_center'|'regional'|'district'; ward: 'all'|'icu'|'non_icu'; setting: 'all'|'co'|'ho' (community-onset / hospital-onset infection per THAS); specimen: 'all'|'blood'|'urine'|'sputum'|'pus'|'stool'; isolates: number|null; resistant_pct: number; susceptible_pct?: number; precision: 'table'|'text'|'chart_estimate'; reportYear?: number }`
   → **Real data** transcribed from the three PDFs in `raw/` (see docs/TRANSCRIPTION.md). Data years 2017–2024. `provisional:false` once ingested; `precision` tells the UI how exact each value is (chart_estimate ≈ ±1–2 pts).
2b. `isolates.json` — `IsolateRecord { year; organism; scope: 'all'|'blood'|'urine'|'sputum'|'pus'|'stool'|'co'|'ho'; level?: 'all'|'medical_center'|'regional'|'district'; rank?: number; isolates: number }` (菌株數監測 tables + MDRO count charts).
   dims: `pathogens` (code = short: SAU, EFM, EFA, ECO, KPN, PAE, ABA, ENT(Enterobacter), SPN, CDI?; meta: {gram, whoPriority:'critical'|'high'|'medium', keyPhenotype}),
   `antibiotics` (OXA=oxacillin/methicillin, VAN, CRO/3GC, MEM/carbapenem, CIP/FQ, PIP-TZP, AMK, COL, TGC, LVX, PEN, ERY, CAZ, FEP, SXT),
   `phenotypes` (MRSA, VRE, CRAB, CRKP, CRPA, CRE, 3GC-R-ECO, 3GC-R-KPN, FQ-R-ECO, PNSP, …).
3. `antibiotic_use.json` — `AmuRecord { year; level; setting: 'inpatient'|'outpatient'|'all'; atc: string (J01, J01CR05, J01DH…); className: code; aware: 'Access'|'Watch'|'Reserve'|'Not recommended'|'Unclassified'; metric: 'DID' (DDD/1000 patient-days) | 'DDD_per_1000_inhabitants_day' | 'DOT'; value: number }` dims: `classes`, `aware`.
4. `hai.json` — `HaiRecord { year; level; icu_type: 'all'|'medical'|'surgical'|'mixed'|'cardiac'|'neuro'|'pediatric'|'neonatal'|'burn'; metric: 'hai_density'|'clabsi'|'cauti'|'vap'|'central_line_util'|'urinary_cath_util'|'ventilator_util'|'bsi_density'|'uti_density'|'pneu_density'; value; unit }` + `hai_pathogens.json` `{ year; level; site: 'all'|'bsi'|'uti'|'pneu'; rank; pathogen; pct }`.
5. `glass.json` — `GlassRecord { iso3; country: LocalizedText; whoRegion; year; indicator: 'MRSA_BLOOD'|'3GC_R_ECO_BLOOD'|'CR_ECO_BLOOD'|'3GC_R_KPN_BLOOD'|'CR_KPN_BLOOD'|'CR_ABA_BLOOD'|'CR_PAE_BLOOD'|'VRE_EFM_BLOOD'|'FQ_R_ECO_BLOOD'|'PNSP_BLOOD'; resistant_pct; isolates|null; source }` — includes a `TWN` row per indicator derived from Taiwan data (blood or ICU/all fallback, flagged in `meta.comparability`).
6. `links.json` — `LinkRecord { id; org; name: LocalizedText; url; category: 'amr'|'amu'|'hai'|'one-health'|'data-portal'|'guideline'; region; description: LocalizedText; tags[] }`.
7. `glossary.json` — `{ term; abbr; definition: LocalizedText; related[] }`.
8. `kb.json` — chatbot knowledge base `{ id; lang: 'zh-TW'|'en'|'ja'; q: string[]; a: string; chart?: ChartLink; tags[] }`.

**Data provenance policy (UPDATED):** The user supplied three PDFs in `raw/`: 臺灣抗生素抗藥性監視年報 2022, 2023, 2024 (all **resistance** reports; THAS AR module; data 2017–2024). `resistance.json` and `isolates.json` are built from them (`provisional:false`, with per-record `precision`). No antibiotic-use (AMU) or HAI annual reports were supplied, so `antibiotic_use.json`, `hai.json`, `hai_pathogens.json` and `glass.json` stay **provisional curated estimates** (`provisional:true`, UI shows the ProvisionalBanner/chip on those sections only, with a link telling the user how to add the AMU/HAI PDFs to `raw/`). Nothing provisional may be presented as official.

## 5. Design system
- Two themes via `data-theme="light"|"dark"` on `<html>`; default follows `prefers-color-scheme`; persisted in localStorage `twamr.theme`.
  - Light: paper `#f7f8f7`, surface `#ffffff`, ink `#0f1a16`, accent `#0e7c5b` (jade), accent-2 `#1f6feb`, danger `#c6373c`.
  - Dark ("黑綠"): bg `#070b0a`, surface `#0e1512`, surface-2 `#132019`, ink `#d8f3e6`, accent `#00e38c` (phosphor green), accent-2 `#49c7ff`, danger `#ff5c5c`, glow via `box-shadow: 0 0 24px rgb(0 227 140 / .25)`.
- Chart palette (categorical, both themes, in `palette.ts`): `['#00b37e','#2f81f7','#f2a93b','#e05d6f','#8b6cf6','#17b8c6','#c08c3a','#7a9a01']`, sequential resistance scale 0→100%: green→amber→red (`#1a9c6b`→`#f2c14e`→`#d43d51`); dark theme uses the same hues lifted +8% L.
- Typography: Inter Variable + CJK fallback; display numerals tabular (`font-variant-numeric: tabular-nums`).
- Motion: page sections fade/slide in (framer-motion, respect `prefers-reduced-motion`); KPI counters animate; charts use ECharts `animationDuration` 900ms with `cubicOut`.
- Layout: top nav (logo, routes, lang switch, theme toggle, search), content max-width 1320px, 16px gutters, responsive to 360px.
- Every chart lives in a `ChartCard` with title, subtitle, source line, **toolbar**: fullscreen, data table toggle, download PNG, download CSV, copy link, Share (X / Threads / Facebook / LINE / Web Share / IG card 1080×1080 & 1080×1920 / copy embed code).
- Accessibility: all charts have `aria-label` + accessible data table; color contrast ≥ 4.5:1 for text; focus rings visible.

## 6. URL / deep-link conventions
- Routes: `#/`, `#/resistance`, `#/antibiotic-use`, `#/hai`, `#/international`, `#/data`, `#/resources`, `#/about`, `#/chat`.
- Query state in hash: `#/resistance?pathogen=ABA&antibiotic=MEM&level=medical_center&ward=icu&years=2014-2024&lang=en&theme=dark`.
- Embed: `embed.html#/?chart=resistance-trend&pathogen=KPN&antibiotic=MEM&lang=zh-TW&theme=light&compact=1`. `public/embed.js` usage: `<script src="https://ancientsky.github.io/tw_amr_dashboard/embed.js" data-chart="resistance-trend" data-pathogen="KPN" data-lang="zh-TW"></script>`.

## 7. Agent rules
- Only edit files inside the directories you were assigned. Shared files (`routes.tsx`, i18n JSON, `types.ts`) — append only; never reformat others' keys.
- i18n: add keys for all 3 languages in the same commit. zh-TW is the primary copy; en and ja must be real translations, not placeholders.
- Run `npm run build && npm run lint` before reporting done. Report exactly what you built, what is stubbed, and any contract deviations.
- No network calls at runtime except: optional user-supplied Claude API key in the chatbot (Anthropic Messages API, model `claude-haiku-5-5`, header `anthropic-dangerous-direct-browser-access: true`) and social share intents.
- Keep bundle lean: lazy-load routes with `React.lazy`; ECharts imported once.
