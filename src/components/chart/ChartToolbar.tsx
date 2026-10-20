import type { QueryPatch } from '../../app/url';
import { useT } from '../../i18n';
import { ShareMenu } from '../share/ShareMenu';
import { IconButton } from '../ui/IconButton';
import type { RenderedImage } from './exportImage';
import s from './chart.module.css';

export interface ToolbarFeatures {
  fullscreen?: boolean;
  table?: boolean;
  png?: boolean;
  csv?: boolean;
  link?: boolean;
  share?: boolean;
}

export interface ChartToolbarProps {
  title: string;
  subtitle?: string;
  fileName: string;
  features?: ToolbarFeatures;
  /** fullscreen state + toggle */
  fullscreen?: { active: boolean; toggle: () => void };
  /** table toggle (omit to hide the button) */
  table?: { shown: boolean; toggle: () => void };
  onDownloadPng?: () => void;
  onDownloadCsv?: () => void;
  onCopyLink?: () => void;
  /** share menu wiring */
  share?: {
    url: string;
    getImage?: () => Promise<RenderedImage>;
    getChartImage?: () => Promise<string | undefined>;
    embed?: { chart: string; params?: QueryPatch };
    card?: { eyebrow?: string; keyValue?: string; keyLabel?: string; source?: string };
    provisional?: boolean;
  };
  busy?: boolean;
}

/** Card toolbar: fullscreen · table · PNG · CSV · link · share. Each button can be disabled via `features`. */
export function ChartToolbar({ title, subtitle, fileName, features = {}, fullscreen, table, onDownloadPng, onDownloadCsv, onCopyLink, share, busy }: ChartToolbarProps) {
  const t = useT();
  const f = { fullscreen: true, table: true, png: true, csv: true, link: true, share: true, ...features };
  return (
    <div className={s.toolbar} role="toolbar" aria-label={t('toolbar.label')} data-export="hide" data-print="hide">
      {f.table && table && (
        <IconButton
          size="sm"
          icon={table.shown ? 'chart' : 'table'}
          label={table.shown ? t('toolbar.hideTable') : t('toolbar.showTable')}
          aria-pressed={table.shown}
          active={table.shown}
          onClick={table.toggle}
        />
      )}
      {f.png && onDownloadPng && <IconButton size="sm" icon="download" label={t('toolbar.png')} onClick={onDownloadPng} disabled={busy} />}
      {f.csv && onDownloadCsv && <IconButton size="sm" icon="file-csv" label={t('toolbar.csv')} onClick={onDownloadCsv} className={s.hideNarrow} />}
      {f.link && onCopyLink && <IconButton size="sm" icon="link" label={t('toolbar.link')} onClick={onCopyLink} />}
      {f.fullscreen && fullscreen && (
        <IconButton
          size="sm"
          icon={fullscreen.active ? 'fullscreen-exit' : 'fullscreen'}
          label={fullscreen.active ? t('toolbar.exitFullscreen') : t('toolbar.fullscreen')}
          onClick={fullscreen.toggle}
          className={s.hideNarrow}
        />
      )}
      {f.share && share && (
        <>
          <span className={s.toolbarSep} aria-hidden="true" />
          <ShareMenu
            title={title}
            subtitle={subtitle}
            url={share.url}
            getImage={share.getImage}
            getChartImage={share.getChartImage}
            embed={share.embed}
            card={share.card}
            provisional={share.provisional}
            fileName={fileName}
          />
        </>
      )}
    </div>
  );
}
