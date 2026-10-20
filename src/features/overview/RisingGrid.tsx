import type { EChartsOption } from 'echarts';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart } from '../../components/chart/EChart';
import { colorMap, LEVEL_ORDER, withAlpha } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Icon } from '../../components/ui/icons';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fmtDelta, fmtPct } from '../../data/format';
import type { OnsetSetting } from '../../data/types';
import { useT } from '../../i18n';
import { alignPoints, isEstimate, LEVEL_KEYS, MDROS, niceMax, SETTING_KEYS, summarize, trendPoints, yearSpan, type TrendIndex } from '../resistance/lib';
import { resistanceSource, useResistanceModel } from '../resistance/model';
import s from './overview.module.css';

const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

/** "Where is resistance rising?" — 9 small multiples, hospital levels as series, fixed y-domain per MDRO. */
export function RisingGrid() {
  const t = useT();
  const { env, trend, status, isFixture } = useResistanceModel();
  const [setting, setSetting] = useState<OnsetSetting>('all');
  const years = useMemo(() => yearSpan(2017, 2024), []);
  const ct = useChartTheme();
  const color = colorMap([...LEVEL_ORDER], ct.theme);

  const rows = useMemo(() => {
    if (!trend) return [];
    const out: Record<string, string | number | null>[] = [];
    for (const ph of MDROS)
      for (const lv of LEVEL_KEYS) {
        const pts = trendPoints(trend, ph, lv, setting);
        if (!pts.length) continue;
        const row: Record<string, string | number | null> = { [t('common.phenotype')]: ph, [t('common.level')]: t(`levels.${lv}`) };
        for (const p of pts) row[String(p.year)] = p.value;
        out.push(row);
      }
    return out;
  }, [trend, setting, t]);

  return (
    <ChartCard
      id="overview-rising"
      eyebrow={t('overview.rising.eyebrow')}
      title={t('overview.rising.title')}
      subtitle={t('overview.rising.subtitle', { setting: t(`settings.${setting}`) })}
      source={resistanceSource(env, t.locale)}
      dataset="resistance"
      isFixture={isFixture}
      precision="chart_estimate"
      status={status}
      tableRows={rows}
      fileName={`twamr-mdro-small-multiples-${setting}`}
      height={560}
      actions={
        <div className={s.risingActions}>
          <SegmentedControl
            options={SETTING_KEYS.map((v) => ({ value: v, label: t(`resistance.settingShort.${v}`), title: t(`settings.${v}`) }))}
            value={setting}
            onChange={setSetting}
            label={t('common.setting')}
            size="sm"
          />
          <ul className={s.legend} aria-label={t('common.level')}>
            {LEVEL_KEYS.map((l) => (
              <li key={l}>
                <span className={s.legendKey} style={{ background: color(l), height: l === 'all' ? 3 : 2 }} />
                {t(`levels.${l}`)}
              </li>
            ))}
            <li>
              <span className={s.legendHollow} />
              {t('precision.chart_estimate')}
            </li>
          </ul>
        </div>
      }
    >
      {trend && (
        <div className={s.multiples}>
          {MDROS.map((ph) => (
            <Mini key={ph} ph={ph} trend={trend} setting={setting} years={years} />
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function Mini({ ph, trend, setting, years }: { ph: string; trend: TrendIndex; setting: OnsetSetting; years: number[] }) {
  const t = useT();
  const ct = useChartTheme();
  const nav = useNavigate();
  const color = useMemo(() => colorMap([...LEVEL_ORDER], ct.theme), [ct.theme]);
  // y-domain fixed per phenotype across settings and levels so toggling never rescales
  const yMax = useMemo(() => {
    let m = 0;
    for (const st of SETTING_KEYS) for (const lv of LEVEL_KEYS) for (const p of trendPoints(trend, ph, lv, st)) m = Math.max(m, p.value);
    return niceMax(m, 2);
  }, [trend, ph]);
  const nat = trendPoints(trend, ph, 'all', setting);
  const sm = summarize(nat);

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    return {
      animationDuration: 700,
      grid: { left: 2, right: 18, top: 8, bottom: 2, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (raw: unknown) => {
          const arr = raw as { seriesName: string; value: number | null; color: string; axisValue: string }[];
          return `<div style="font-weight:700">${ph} · ${arr[0]?.axisValue ?? ''}</div>${arr
            .filter((p) => p.value !== null && p.value !== undefined)
            .map((p) => `<div style="display:flex;justify-content:space-between;gap:12px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${esc(p.seriesName)}</span><b>${fmtPct(p.value, t.locale)}</b></div>`)
            .join('')}`;
        },
      },
      xAxis: { type: 'category', data: years.map(String), boundaryGap: false, axisLabel: { interval: (i: number) => i === 0 || i === years.length - 1, fontSize: 10.5 } },
      yAxis: { type: 'value', min: 0, max: yMax, splitNumber: 2, axisLabel: { formatter: '{value}%', fontSize: 10.5 } },
      series: LEVEL_KEYS.map((lv) => {
        const pts = alignPoints(trendPoints(trend, ph, lv, setting), years);
        const c = color(lv);
        const nat = lv === 'all';
        return {
          name: t(`levels.${lv}`),
          type: 'line',
          z: nat ? 5 : 2,
          showSymbol: nat,
          symbolSize: 6,
          lineStyle: { width: nat ? 2.5 : 1.5, color: c, opacity: nat ? 1 : 0.8 },
          itemStyle: { color: c },
          areaStyle: nat ? { color: withAlpha(c, 0.08) } : undefined,
          data: pts.map((p) => (p ? { value: p.value, itemStyle: isEstimate(p) ? { color: k.surface, borderColor: c, borderWidth: 1.5 } : { color: c, borderColor: k.surface, borderWidth: 1.5 } } : null)),
        };
      }),
    } as EChartsOption;
  }, [ct.tokens, trend, ph, setting, years, yMax, color, t]);

  const up = (sm?.change ?? 0) > 0.5;
  const down = (sm?.change ?? 0) < -0.5;
  return (
    <div className={s.mini}>
      <button type="button" className={s.miniHead} onClick={() => nav(`/resistance?phenotype=${encodeURIComponent(ph)}${setting !== 'all' ? `&setting=${setting}` : ''}`)}>
        <span className={s.miniCode}>{ph}</span>
        {sm && (
          <span className={s.miniValue}>
            {fmtPct(sm.last.value, t.locale)}
            <span className={[s.miniDelta, up ? s.bad : down ? s.good : ''].join(' ')} title={t('overview.rising.changeSince', { year: sm.first.year })}>
              {(up || down) && <Icon name={up ? 'arrow-up' : 'arrow-down'} size={11} />}
              {fmtDelta(sm.change, t.locale)}
            </span>
          </span>
        )}
      </button>
      <EChart option={option} height={150} ariaLabel={t('overview.rising.miniAria', { phenotype: ph })} />
    </div>
  );
}
