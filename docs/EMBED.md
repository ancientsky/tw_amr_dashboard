# Embedding TW-AMR Watch charts · 嵌入圖表

Hospitals and partners can embed live TW-AMR Watch charts with a single script tag. The loader (`public/embed.js`,
~2 KB, no dependencies) replaces its own `<script>` element with a responsive `<iframe>` pointing at `embed.html`,
and resizes it automatically to fit the chart (via `postMessage`).

醫院網站只要貼上一行 `<script>` 即可嵌入即時圖表；載入器會以自適應高度的 iframe 取代自身。

## Quick start

```html
<script src="https://ancientsky.github.io/tw_amr_dashboard/embed.js"
        data-chart="resistance-trend"
        data-pathogen="KPN"
        data-antibiotic="MEM"
        data-lang="zh-TW"
        data-theme="light"
        async></script>
```

Every chart card on the site also has **Share → Copy embed code**, which produces this snippet for the current view.

## Attributes

| Attribute | Values | Default | Notes |
|---|---|---|---|
| `data-chart` | any id from [Charts](#charts) below | — (required) | unknown ids render a friendly "unknown chart" card |
| `data-pathogen` | pathogen code, e.g. `SAU` `EFM` `ECO` `KPN` `PAE` `ABA` | `KPN` | `resistance-trend` |
| `data-antibiotic` | antibiotic code, e.g. `OXA` `VAN` `CRO` `MEM` `CIP` | `MEM` | `resistance-trend` |
| `data-level` | `all` · `medical_center` · `regional` · `district` | `all` | trend: highlights that hospital level |
| `data-ward` | `all` · `icu` · `non_icu` | `all` | where the data has ward strata |
| `data-setting` | `all` · `co` (community-onset) · `ho` (hospital-onset) | `all` | |
| `data-years` | `2018-2024` | all years | trend charts; `resistance-pathogen-bars` / `resistance-co-ho` use the end year as data year |
| `data-year` | `2022` or `latest` | latest | `glass-map`, `glass-bars` |
| `data-indicator` | GLASS indicator, e.g. `MRSA_BLOOD` `CR_KPN_BLOOD` `CR_ABA_BLOOD` | `CR_KPN_BLOOD` | `glass-map`, `glass-bars` |
| `data-region` | `all` · WHO region code (`AFR` `AMR` `SEAR` `EUR` `EMR` `WPR`) | `all` | `glass-map`, `glass-bars` |
| `data-bars` | `countries` · `regions` | `countries` | `glass-bars` |
| `data-metric` | AMU: `DID` · `share`; HAI: `clabsi` · `cauti` · `vap` · `hai_density` … | `DID` / `clabsi` | `amu-stacked`, `hai-trend` |
| `data-classes` | comma-separated AMU class codes | all | `amu-stacked` |
| `data-icu` | `all` · `medical` · `surgical` · `mixed` · `cardiac` · `neuro` · `pediatric` · `neonatal` · `burn` | `all` | `hai-trend` |
| `data-site` | `bsi` · `uti` · `pneu` · `all` | `bsi` | `hai-bump` |
| `data-lang` | `zh-TW` · `en` · `ja` | browser language → `zh-TW` | |
| `data-theme` | `light` · `dark` | visitor's OS preference | |
| `data-compact` | `1` | off | tighter padding, shorter charts |
| `data-height` | CSS length | `440px` | initial height before auto-resize |
| `data-max-width` | CSS length | none | |
| `data-title` | text | chart id | iframe accessible title |

## Charts

| id | What it shows | Params |
|---|---|---|
| `resistance-trend` | % resistant over time for one pathogen × antibiotic, one line per hospital level | pathogen, antibiotic, level, ward, setting, years |
| `resistance-heatmap` | pathogen × antibiotic % resistant matrix, latest year, green→amber→red scale | level, ward, setting |
| `kpi-strip` | MRSA / CRKP / CRAB / VRE stat tiles with change vs previous year and sparklines | level, ward, setting |
| `resistance-co-ho` | community- vs hospital-onset % non-susceptible for the nine MDROs (dumbbell, sorted by gap) | level, years |
| `resistance-pathogen-bars` | % non-susceptible per antibiotic by onset (all / CO / HO) for one pathogen | pathogen, years |
| `glass-map` | world map of one GLASS indicator with Taiwan outlined *(provisional curated data)* | indicator, region, year |
| `glass-bars` | Taiwan vs countries (or WHO-region medians) for one indicator *(provisional)* | indicator, region, year, bars |
| `amu-stacked` | inpatient antibiotic use by class over time *(provisional model)* | level, metric, classes, years |
| `amu-aware` | WHO AWaRe mix by hospital level with the 70 % Access target *(provisional model)* | level, years |
| `hai-trend` | device-associated infection density small multiples by ICU type *(provisional model)* | level, icu, metric, years |
| `hai-bump` | top-10 HAI pathogen ranking over time *(provisional model)* | level, site, years |

Each embedded card keeps the full toolbar (data table, PNG, CSV, copy link, share) and a
"Powered by TW-AMR Watch" link back to the matching page on the site.

## Direct iframe / URL format

If you cannot run scripts, embed the page directly:

```html
<iframe src="https://ancientsky.github.io/tw_amr_dashboard/embed.html#/?chart=resistance-heatmap&lang=en&theme=dark"
        style="width:100%;height:560px;border:0" loading="lazy" title="TW-AMR Watch"></iframe>
```

`embed.html#/?chart=<id>&<param>=<value>…` accepts the same parameters as the `data-*` attributes (without `data-`).

## Auto-height protocol

`embed.html` posts `{ type: 'twamr:resize', id, height }` to its parent whenever its content height changes.
`embed.js` assigns a random `id` per iframe and only applies messages whose `event.source` is that iframe.

## Provenance in embeds

Embedded charts show the same provenance badges as the site: a **Provisional** chip when the dataset envelope says
`provisional: true`, and a **precision** badge (`Read from chart` / `From report text`) for values transcribed from
printed charts. If `public/data` is unreachable the embed falls back to a small bundled development fixture and shows
a **Dev fixture** chip — never present those numbers as real.

## For developers: adding a chart to the registry

Charts live in `src/embed/registry.ts` (append-only). A chart is any component that accepts `ChartParams`
(`src/embed/charts/common.ts`) and renders its own `ChartCard`:

```ts
import { registerEmbedChart } from '../embed/registry';
registerEmbedChart({ id: 'amu-aware', route: '/antibiotic-use', params: ['level'], Component: AmuAwareChart });
```

…or add an entry to `EMBED_REGISTRY` directly. Pass `embed={{ chart: 'amu-aware', params }}` to the card so
**Copy embed code** works.
