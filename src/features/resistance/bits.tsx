import { useId, type ReactNode } from 'react';
import { Tooltip } from '../../components/ui/Tooltip';
import { useT } from '../../i18n';
import s from './resistance.module.css';

/** Accessible on/off switch (native checkbox). */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <label className={s.switch} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={s.switchTrack} aria-hidden="true">
        <span className={s.switchThumb} />
      </span>
      <span className={s.switchText}>
        <span>{label}</span>
        {hint && <span className={s.switchHint}>{hint}</span>}
      </span>
    </label>
  );
}

/** "Precision" legend: solid marker = table/text, hollow = read from chart (±1–2 pp). */
export function PrecisionLegend() {
  const t = useT();
  return (
    <div className={s.precision}>
      <span className={s.railLabel}>{t('precision.label')}</span>
      <ul className={s.precisionList}>
        <li>
          <Tooltip content={t('precision.tableHint')}>
            <span className={s.precisionItem} tabIndex={0}>
              <span className={s.mkSolid} aria-hidden="true" />
              {t('precision.table')}
            </span>
          </Tooltip>
        </li>
        <li>
          <Tooltip content={t('precision.textHint')}>
            <span className={s.precisionItem} tabIndex={0}>
              <span className={s.mkSolid} aria-hidden="true" />
              {t('precision.text')}
            </span>
          </Tooltip>
        </li>
        <li>
          <Tooltip content={t('precision.chart_estimateHint')}>
            <span className={s.precisionItem} tabIndex={0}>
              <span className={s.mkHollow} aria-hidden="true" />
              {t('precision.chart_estimate')}
            </span>
          </Tooltip>
        </li>
      </ul>
    </div>
  );
}

/** Labelled block inside the control rail. */
export function RailGroup({ label, children, aside }: { label: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={s.railGroup}>
      <div className={s.railGroupHead}>
        <span className={s.railLabel}>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Narrative paragraph with an accent rule. */
export function Narrative({ children }: { children: ReactNode }) {
  return <div className={s.narrative}>{children}</div>;
}
