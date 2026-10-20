import { useMemo } from 'react';
import { deepLink } from '../../app/url';
import { ShareMenu } from '../../components/share/ShareMenu';
import { Icon } from '../../components/ui/icons';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDataset } from '../../data/load';
import { fmtDelta, fmtNumber, fmtPct } from '../../data/format';
import { useT, type TFunction } from '../../i18n';
import { resistanceSource, useResistanceModel } from '../resistance/model';
import { computeHeadlines, type HVar } from './headlines';
import { Reveal } from './Reveal';
import s from './overview.module.css';

export function formatVar(t: TFunction, v: HVar): string {
  switch (v.t) {
    case 'pct':
      return fmtPct(v.v, t.locale);
    case 'pp':
      return `${fmtDelta(v.v, t.locale)} ${t('kpi.pp')}`;
    case 'n':
      return fmtNumber(v.v, t.locale);
    case 'rel':
      return `${fmtDelta(v.v, t.locale, 0)}%`;
    case 'level':
      return t(`levels.${v.v}`);
    default:
      return String(v.v);
  }
}

/** 4–6 auto-generated, data-derived headline sentences, each shareable. */
export function Headlines() {
  const t = useT();
  const { env, trend, status } = useResistanceModel();
  const iso = useDataset('isolates');
  const specs = useMemo(() => (trend ? computeHeadlines(trend, iso.data?.records ?? []) : []), [trend, iso.data]);
  const source = resistanceSource(env, t.locale);

  if (status === 'loading' || !trend)
    return (
      <div className={s.headlines} aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={s.headline}>
            <Skeleton height={14} width="40%" />
            <Skeleton height={44} />
          </div>
        ))}
      </div>
    );

  return (
    <ol className={s.headlines}>
      {specs.map((h, i) => {
        const vars = Object.fromEntries(Object.entries(h.vars).map(([k, v]) => [k, formatVar(t, v)]));
        const text = t(`overview.headlines.${h.key}`, vars);
        const url = deepLink(h.link.path, h.link.params);
        const kicker = t(`overview.headlines.kicker.${h.id}`);
        return (
          <li key={h.id} className={s.headlineItem}>
            <Reveal delay={i * 0.05} className={s.headline}>
              <div className={s.headlineTop}>
                <span className={s.headlineKicker}>
                  <span className={s.headlineNum}>{String(i + 1).padStart(2, '0')}</span>
                  {kicker}
                </span>
                <ShareMenu
                  title={text}
                  url={url}
                  fileName={`twamr-headline-${h.id}`}
                  card={{ eyebrow: kicker, keyValue: formatVar(t, h.key_value), keyLabel: text, source: source ? t('common.sourceLine', { source }) : undefined }}
                />
              </div>
              <p className={s.headlineText}>{text}</p>
              <div className={s.headlineFoot}>
                {h.estimate && <span className={s.headlineEst}>◦ {t('precision.chart_estimate')}</span>}
                <a href={`#${h.link.path}?${new URLSearchParams(h.link.params).toString()}`} className={s.headlineLink}>
                  {t('overview.headlines.explore')}
                  <Icon name="chevron-right" size={14} />
                </a>
              </div>
            </Reveal>
          </li>
        );
      })}
    </ol>
  );
}
