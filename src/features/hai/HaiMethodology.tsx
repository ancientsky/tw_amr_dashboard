import { useT } from '../../i18n';
import { MethodDrawer } from '../international/kit/Kit';

export const TNIS_URL = 'https://www.cdc.gov.tw/Category/MPage/4G8HuDdUN1k4xaBJhbPzKQ';
export const NHSN_URL = 'https://www.cdc.gov/nhsn/psc/index.html';

/** Methodology drawer: TNIS definitions, denominators, SIR note, provisional notice. */
export function HaiMethodology() {
  const t = useT();
  return (
    <MethodDrawer label={t('hai.method.button')} title={t('hai.method.title')}>
      <h3>{t('hai.method.tnisTitle')}</h3>
      <p>{t('hai.method.tnis')}</p>
      <h3>{t('hai.method.defsTitle')}</h3>
      <dl>
        <dt>{t('hai.short.hai_density')}</dt>
        <dd>{t('hai.method.density')}</dd>
        <dt>CLABSI</dt>
        <dd>{t('hai.method.clabsi')}</dd>
        <dt>CAUTI</dt>
        <dd>{t('hai.method.cauti')}</dd>
        <dt>VAP</dt>
        <dd>{t('hai.method.vap')}</dd>
        <dt>DUR</dt>
        <dd>{t('hai.method.dur')}</dd>
      </dl>
      <h3>{t('hai.method.denomTitle')}</h3>
      <p>{t('hai.method.denom')}</p>
      <h3>{t('hai.method.sirTitle')}</h3>
      <p>{t('hai.method.sir')}</p>
      <h3>{t('hai.method.provTitle')}</h3>
      <p>{t('hai.method.prov')}</p>
      <p>
        {t('hai.method.provHow')} <code>raw/</code>
      </p>
      <h3>{t('hai.method.linksTitle')}</h3>
      <ul>
        <li>
          <a href={TNIS_URL} target="_blank" rel="noreferrer">
            {t('hai.method.linkCdc')} ↗
          </a>
        </li>
        <li>
          <a href={NHSN_URL} target="_blank" rel="noreferrer">
            {t('hai.method.linkNhsn')} ↗
          </a>
        </li>
      </ul>
    </MethodDrawer>
  );
}
