import { useEffect, useMemo, useRef, useState } from 'react';
import { NAV } from '../../app/nav';
import { useMeta } from '../../app/providers/DataProvider';
import { SITE_URL, siteBase } from '../../app/url';
import { Icon, SegmentedControl, Select, type SelectOption } from '../../components/ui';
import { dimName } from '../../data/format';
import { useDataset } from '../../data/load';
import { LEVELS, ONSET_SETTINGS, WARDS, type Locale } from '../../data/types';
import { EMBED_REGISTRY } from '../../embed/registry';
import { hasKey, useT } from '../../i18n';
import { useLocale } from '../../app/providers/LocaleProvider';
import { CodeBlock } from './CodeBlock';
import s from './dataApi.module.css';

const DEFAULT_HEIGHT = 440;
const ALL = '__all__';

type ParamKey = 'pathogen' | 'antibiotic' | 'level' | 'ward' | 'setting' | 'years';

const AUTO_HEIGHT_SNIPPET = `window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'twamr:resize' && e.source === iframe.contentWindow) {
    iframe.style.height = Math.ceil(e.data.height) + 'px';
  }
});`;

export function EmbedBuilder() {
  const t = useT();
  const { locale } = useLocale();
  const { meta } = useMeta();
  const res = useDataset('resistance');
  const registry = EMBED_REGISTRY;
  const ids = Object.keys(registry);

  const [chart, setChart] = useState(ids.includes('resistance-trend') ? 'resistance-trend' : ids[0]);
  const [vals, setVals] = useState<Record<string, string>>({ pathogen: 'KPN', antibiotic: 'MEM' });
  const [lang, setLang] = useState<Locale>(locale);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [compact, setCompact] = useState(false);
  const [height, setHeight] = useState(String(DEFAULT_HEIGHT));
  const [autoH, setAutoH] = useState<number | null>(null);

  const def = registry[chart] ?? registry[ids[0]];
  const years = meta?.yearsAvailable ?? [];
  const h = Math.min(2000, Math.max(160, Math.round(Number(height)) || DEFAULT_HEIGHT));

  // only send the params this chart understands
  const active = useMemo(
    () =>
      def.params.filter((p): p is ParamKey =>
        ['pathogen', 'antibiotic', 'level', 'ward', 'setting', 'years'].includes(p),
      ),
    [def],
  );

  const query = useMemo(() => {
    const q: [string, string][] = [['chart', def.id]];
    for (const p of active) {
      if (p === 'years') {
        const a = vals.yearFrom;
        const b = vals.yearTo;
        if (a && b && a !== ALL && b !== ALL) q.push(['years', `${a}-${b}`]);
      } else if (vals[p] && vals[p] !== ALL) q.push([p, vals[p]]);
    }
    q.push(['lang', lang]);
    if (theme !== 'auto') q.push(['theme', theme]);
    if (compact) q.push(['compact', '1']);
    return q;
  }, [def.id, active, vals, lang, theme, compact]);

  const publicIframe = `${SITE_URL}embed.html#/?${query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  const previewSrc = `${siteBase()}embed.html#/?${query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}&id=builder`;

  const scriptSnippet = useMemo(() => {
    const attrs = query.map(([k, v]) => `        data-${k}="${v}"`);
    if (h !== DEFAULT_HEIGHT) attrs.push(`        data-height="${h}px"`);
    return `<script src="${SITE_URL}embed.js"\n${attrs.join('\n')}\n        async></script>`;
  }, [query, h]);

  const iframeSnippet = `<iframe src="${publicIframe}"\n        style="display:block;width:100%;height:${autoH ?? h}px;border:0"\n        loading="lazy" title="TW-AMR Watch" allow="clipboard-write; fullscreen"></iframe>`;

  // auto-height reports from the preview iframe (same protocol as embed.js)
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    setAutoH(null);
  }, [previewSrc]);
  useEffect(() => {
    const fn = (e: MessageEvent) => {
      const d = e.data as { type?: string; id?: string; height?: number } | null;
      if (
        e.source === frame.current?.contentWindow &&
        d?.type === 'twamr:resize' &&
        typeof d.height === 'number' &&
        d.height > 0
      )
        setAutoH(Math.ceil(d.height));
    };
    window.addEventListener('message', fn);
    return () => window.removeEventListener('message', fn);
  }, []);

  const set = (k: string) => (v: string) => setVals((m) => ({ ...m, [k]: v }));
  const chartLabel = (id: string) =>
    hasKey(locale, `data.embed.charts.${id}`) ? t(`data.embed.charts.${id}`) : id;
  const pageOf = (route: string) => NAV.find((n) => n.path === route);

  const dimOpts = (dimKey: 'pathogens' | 'antibiotics', withAll = false): SelectOption[] => {
    const dims = res.data?.dims?.[dimKey] ?? [];
    const opts = dims.map((d) => ({ value: d.code, label: `${d.code} · ${dimName(dims, d.code, locale)}` }));
    return withAll ? [{ value: ALL, label: t('common.all') }, ...opts] : opts;
  };

  const chartOpts: SelectOption[] = ids.map((id) => ({
    value: id,
    label: chartLabel(id),
    hint: <code>{id}</code>,
  }));
  const yearOpts: SelectOption[] = [
    { value: ALL, label: t('common.all') },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];

  return (
    <div className={s.stack}>
      <div className={s.builder}>
        <form className={s.form} onSubmit={(e) => e.preventDefault()} aria-label={t('data.embed.formLabel')}>
          <Select
            label={t('data.embed.chart')}
            showLabel
            options={chartOpts}
            value={def.id}
            onChange={setChart}
            minWidth={220}
          />
          {pageOf(def.route) && (
            <p className={s.hint}>{t('data.embed.showsOn', { page: t(`nav.${pageOf(def.route)!.key}`) })}</p>
          )}

          {active.includes('pathogen') && (
            <Select
              label={t('common.pathogen')}
              showLabel
              options={dimOpts('pathogens')}
              value={vals.pathogen ?? 'KPN'}
              onChange={set('pathogen')}
              minWidth={220}
            />
          )}
          {active.includes('antibiotic') && (
            <Select
              label={t('common.antibiotic')}
              showLabel
              options={dimOpts('antibiotics')}
              value={vals.antibiotic ?? 'MEM'}
              onChange={set('antibiotic')}
              minWidth={220}
            />
          )}
          {active.includes('level') && (
            <Select
              label={t('common.level')}
              showLabel
              options={LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
              value={vals.level && vals.level !== ALL ? vals.level : 'all'}
              onChange={set('level')}
              minWidth={220}
            />
          )}
          {active.includes('ward') && (
            <Select
              label={t('common.ward')}
              showLabel
              options={WARDS.map((l) => ({ value: l, label: t(`wards.${l}`) }))}
              value={vals.ward && vals.ward !== ALL ? vals.ward : 'all'}
              onChange={set('ward')}
              minWidth={220}
            />
          )}
          {active.includes('setting') && (
            <Select
              label={t('common.setting')}
              showLabel
              options={ONSET_SETTINGS.map((l) => ({ value: l, label: t(`settings.${l}`) }))}
              value={vals.setting && vals.setting !== ALL ? vals.setting : 'all'}
              onChange={set('setting')}
              minWidth={220}
            />
          )}
          {active.includes('years') && (
            <div className={s.pair}>
              <Select
                label={t('data.embed.yearFrom')}
                showLabel
                options={yearOpts}
                value={vals.yearFrom ?? ALL}
                onChange={set('yearFrom')}
              />
              <Select
                label={t('data.embed.yearTo')}
                showLabel
                options={yearOpts}
                value={vals.yearTo ?? ALL}
                onChange={set('yearTo')}
              />
            </div>
          )}

          <div className={s.pair}>
            <div className={s.ctl}>
              <span className={s.ctlLabel}>{t('data.embed.lang')}</span>
              <SegmentedControl<Locale>
                label={t('data.embed.lang')}
                size="sm"
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'zh-TW', label: t('lang.short.zh-TW'), title: t('lang.zh-TW') },
                  { value: 'en', label: t('lang.short.en'), title: t('lang.en') },
                  { value: 'ja', label: t('lang.short.ja'), title: t('lang.ja') },
                ]}
              />
            </div>
            <div className={s.ctl}>
              <span className={s.ctlLabel}>{t('data.embed.theme')}</span>
              <SegmentedControl<'auto' | 'light' | 'dark'>
                label={t('data.embed.theme')}
                size="sm"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'auto', label: t('data.embed.themeAuto') },
                  { value: 'light', label: t('theme.light') },
                  { value: 'dark', label: t('theme.dark') },
                ]}
              />
            </div>
          </div>

          <div className={s.pair}>
            <label className={s.check}>
              <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
              <span>{t('data.embed.compact')}</span>
            </label>
            <label className={s.ctl}>
              <span className={s.ctlLabel}>{t('data.embed.height')}</span>
              <span className={s.numWrap}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={160}
                  max={2000}
                  step={20}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className={s.num}
                  aria-label={t('data.embed.height')}
                />
                <span className={s.unit}>px</span>
              </span>
            </label>
          </div>
        </form>

        <div className={s.preview}>
          <div className={s.previewBar}>
            <span className={s.previewTitle}>
              <Icon name="chart" size={16} /> {t('data.embed.preview')}
            </span>
            <span className={s.muted}>
              {autoH ? t('data.embed.autoHeight', { px: autoH }) : t('common.loading')}
            </span>
          </div>
          <div className={s.previewFrame} data-theme-hint={theme}>
            <iframe
              key={previewSrc}
              ref={frame}
              src={previewSrc}
              title={t('data.embed.previewTitle')}
              className={s.iframe}
              style={{ height: autoH ?? h }}
              loading="lazy"
              allow="clipboard-write; fullscreen"
            />
          </div>
        </div>
      </div>

      <div className={s.twoCol}>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="code" size={18} /> {t('data.embed.scriptTitle')}
          </h3>
          <p className={s.prose}>{t('data.embed.scriptBody')}</p>
          <CodeBlock code={scriptSnippet} label={t('data.embed.scriptTitle')} />
        </div>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="code" size={18} /> {t('data.embed.iframeTitle')}
          </h3>
          <p className={s.prose}>{t('data.embed.iframeBody')}</p>
          <CodeBlock code={iframeSnippet} label={t('data.embed.iframeTitle')} />
        </div>
      </div>

      <div className={s.twoCol}>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="info" size={18} /> {t('data.embed.heightTitle')}
          </h3>
          <p className={s.prose}>{t('data.embed.heightBody')}</p>
          <CodeBlock code={AUTO_HEIGHT_SNIPPET} label={t('data.embed.heightTitle')} />
        </div>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="chat" size={18} /> {t('data.embed.useTitle')}
          </h3>
          <ul className={s.bullets}>
            {(['intranet', 'committee', 'stewardship', 'public'] as const).map((k) => (
              <li key={k}>
                <strong>{t(`data.embed.use.${k}.t`)}</strong> — {t(`data.embed.use.${k}.d`)}
              </li>
            ))}
          </ul>
          <p className={s.note}>{t('data.embed.provNote')}</p>
        </div>
      </div>
    </div>
  );
}
