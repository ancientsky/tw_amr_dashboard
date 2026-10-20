import '@fontsource-variable/inter';
import '../styles/global.css';
import './embed.css';
import { MotionConfig } from 'framer-motion';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DataProvider } from '../app/providers/DataProvider';
import { LocaleProvider } from '../app/providers/LocaleProvider';
import { ThemeProvider } from '../app/providers/ThemeProvider';
import { deepLink, parseHashQuery } from '../app/url';
import { EmptyState } from '../components/ui/EmptyState';
import { ToastProvider } from '../components/ui/Toast';
import { useT } from '../i18n';
import { parseChartParams } from './charts/common';
import { EMBED_IDS, EMBED_REGISTRY } from './registry';

/** Hash query of embed.html: #/?chart=…&pathogen=…&lang=…&theme=…&compact=1&id=… */
function useHashParams(): URLSearchParams {
  const [q, setQ] = useState(() => parseHashQuery());
  useEffect(() => {
    const fn = () => setQ(parseHashQuery());
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return q;
}

/** Report content height to the host page (public/embed.js listens). */
function useAutoHeight(id: string | null) {
  useEffect(() => {
    if (window.parent === window) return;
    let last = 0;
    const post = () => {
      const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (Math.abs(h - last) < 2) return;
      last = h;
      window.parent.postMessage({ type: 'twamr:resize', id, height: h }, '*');
    };
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, [id]);
}

function EmbedView({ q }: { q: URLSearchParams }) {
  const t = useT();
  const chart = q.get('chart') ?? '';
  const def = EMBED_REGISTRY[chart];
  const params = parseChartParams(q);
  useEffect(() => {
    document.title = `${def ? chart : t('embed.unknownTitle')} · ${t('app.name')}`;
  }, [def, chart, t]);

  if (!def) {
    return (
      <div className="embed-unknown">
        <EmptyState icon="alert" title={t('embed.unknownTitle')} body={t('embed.unknownBody', { id: chart || '∅', ids: EMBED_IDS().join(', ') })} />
      </div>
    );
  }
  const linkParams: Record<string, string> = { ...def.routeParams };
  for (const k of def.params) {
    const v = q.get(k);
    if (v) linkParams[k] = v;
  }
  linkParams.lang = t.locale;
  linkParams.chart = def.id;
  const link = deepLink(def.route, linkParams);
  const { Component } = def;
  return (
    <>
      <Component {...params} link={link} fixtureFallback />
      <a className="embed-credit" href={link} target="_blank" rel="noopener">
        {t('embed.poweredBy')} ↗
      </a>
    </>
  );
}

function EmbedApp() {
  const q = useHashParams();
  useAutoHeight(q.get('id'));
  const compact = q.get('compact') === '1' || q.get('compact') === 'true';
  useEffect(() => {
    document.documentElement.classList.toggle('embed-compact', compact);
  }, [compact]);
  return (
    <ThemeProvider urlTheme={q.get('theme')} persist={false}>
      <LocaleProvider urlLang={q.get('lang')} persist={false}>
        <DataProvider fixtureFallback>
          <ToastProvider>
            <main className="embed-root">
              <EmbedView q={q} />
            </main>
          </ToastProvider>
        </DataProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <EmbedApp />
    </MotionConfig>
  </StrictMode>,
);
