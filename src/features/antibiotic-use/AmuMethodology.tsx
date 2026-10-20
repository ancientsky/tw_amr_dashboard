import { useChartTheme } from '../../components/chart/useChartTheme';
import { dimNamer } from '../../data/format';
import { useDataset } from '../../data/load';
import { useT } from '../../i18n';
import { MethodDrawer } from '../international/kit/Kit';
import k from '../international/kit/kit.module.css';
import { AWARE_COLORS, awareOf, classOrder } from './amuModel';

export const AWARE_URL = 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.04';
export const ATC_DDD_URL = 'https://atcddd.fhi.no/atc_ddd_index/';
export const TW_CDC_URL = 'https://www.cdc.gov.tw/Category/MPage/4G8HuDdUN1k4xaBJhbPzKQ';

/** Methodology drawer: DDD / DID, ATC classes, AWaRe 2023, provisional-data notice. */
export function AmuMethodology() {
  const t = useT();
  const ct = useChartTheme();
  const { data: env } = useDataset('antibiotic_use');
  const dims = env?.dims?.classes;
  const nameCls = dimNamer(dims, t.locale);
  const order = classOrder(dims);
  return (
    <MethodDrawer label={t('amu.method.button')} title={t('amu.method.title')}>
      <h3>{t('amu.method.dddTitle')}</h3>
      <dl>
        <dt>DDD</dt>
        <dd>{t('amu.method.ddd')}</dd>
        <dt>DID</dt>
        <dd>{t('amu.method.did')}</dd>
      </dl>
      <p>{t('amu.method.didFormula')}</p>
      <h3>{t('amu.method.awareTitle')}</h3>
      <p>{t('amu.method.aware')}</p>
      <ul>
        {(['Access', 'Watch', 'Reserve'] as const).map((a) => (
          <li key={a}>
            <span className={k.swatch} style={{ display: 'inline-block', marginRight: 6, background: AWARE_COLORS[ct.theme][a] }} />
            <strong>{t(`amu.aware.${a}`)}</strong> — {t(`amu.method.aware${a}`)}
          </li>
        ))}
      </ul>
      <p>{t('amu.method.target')}</p>
      <h3>{t('amu.method.atcTitle')}</h3>
      <div className={k.tableWrap}>
        <table className={k.table}>
          <thead>
            <tr>
              <th scope="col">{t('amu.class')}</th>
              <th scope="col">ATC</th>
              <th scope="col">{t('amu.awareLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {order.map((c) => {
              const d = dims?.find((x) => x.code === c);
              const aw = awareOf(dims, c);
              return (
                <tr key={c}>
                  <td>{nameCls(c)}</td>
                  <td className={k.num}>{String(d?.meta?.atc ?? '—')}</td>
                  <td>
                    <span className={k.swatch} style={{ display: 'inline-block', marginRight: 6, background: AWARE_COLORS[ct.theme][aw] }} />
                    {t(`amu.aware.${aw}`)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3>{t('amu.method.provTitle')}</h3>
      <p>{t('amu.method.prov')}</p>
      <p>
        {t('amu.method.provHow')} <code>raw/</code>
      </p>
      <h3>{t('amu.method.linksTitle')}</h3>
      <ul>
        <li>
          <a href={AWARE_URL} target="_blank" rel="noreferrer">
            {t('amu.method.linkAware')} ↗
          </a>
        </li>
        <li>
          <a href={ATC_DDD_URL} target="_blank" rel="noreferrer">
            {t('amu.method.linkAtc')} ↗
          </a>
        </li>
        <li>
          <a href={TW_CDC_URL} target="_blank" rel="noreferrer">
            {t('amu.method.linkCdc')} ↗
          </a>
        </li>
      </ul>
    </MethodDrawer>
  );
}
