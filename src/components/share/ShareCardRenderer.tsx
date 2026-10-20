import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useT } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { Button } from '../ui/IconButton';
import { Modal } from '../ui/Modal';
import { SegmentedControl } from '../ui/SegmentedControl';
import { drawShareCard, type CardFormat } from './shareCard';
import s from './share.module.css';

export interface ShareCardRendererProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  keyValue?: string;
  keyLabel?: string;
  source?: string;
  url: string;
  provisional?: boolean;
  /** raw chart image (data URL), rendered inside the card */
  getChartImage?: () => Promise<string | undefined>;
  fileName: string;
}

/** Renders branded 1080×1080 / 1080×1920 PNG cards for Instagram (canvas, no QR code). */
export function ShareCardRenderer(p: ShareCardRendererProps) {
  const t = useT();
  const { theme } = useTheme();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<CardFormat>('square');
  const [busy, setBusy] = useState(false);
  const [chart, setChart] = useState<string | undefined>();
  const { getChartImage, open } = p;

  useEffect(() => {
    if (!open || !getChartImage) return;
    let alive = true;
    getChartImage()
      .then((img) => alive && setChart(img))
      .catch(() => alive && setChart(undefined));
    return () => {
      alive = false;
    };
  }, [open, getChartImage]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const id = requestAnimationFrame(async () => {
      if (!canvas.current || !alive) return;
      setBusy(true);
      try {
        await drawShareCard(
          canvas.current,
          {
            siteName: t('app.name'),
            eyebrow: p.eyebrow,
            title: p.title,
            subtitle: p.subtitle,
            keyValue: p.keyValue,
            keyLabel: p.keyLabel,
            chart,
            source: p.source,
            url: p.url,
            readMore: t('share.readMore'),
            chip: p.provisional ? t('provisional.chip') : undefined,
            theme,
          },
          format,
        );
      } finally {
        if (alive) setBusy(false);
      }
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [open, format, chart, theme, t, p.eyebrow, p.title, p.subtitle, p.keyValue, p.keyLabel, p.source, p.url, p.provisional]);

  const download = () => {
    canvas.current?.toBlob((b) => b && downloadBlob(b, `${p.fileName}-${format === 'square' ? '1080x1080' : '1080x1920'}.png`), 'image/png');
  };

  return (
    <Modal open={p.open} onClose={p.onClose} title={t('share.cardTitle')} width={720}>
      <div className={s.cardLayout}>
        <p className={s.cardHint}>{t('share.cardHint')}</p>
        <SegmentedControl<CardFormat>
          label={t('share.cardTitle')}
          value={format}
          onChange={setFormat}
          options={[
            { value: 'square', label: t('share.square') },
            { value: 'story', label: t('share.story') },
          ]}
        />
        <div className={s.cardStage} data-format={format} aria-busy={busy}>
          <canvas ref={canvas} className={s.cardCanvas} aria-label={p.title} role="img" />
        </div>
        <div className={s.cardActions}>
          <Button variant="primary" icon="download" onClick={download} disabled={busy}>
            {busy ? t('share.rendering') : t('share.downloadCard')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
