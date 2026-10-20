import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { useHashQuery } from '../../app/hooks/useHashQuery';
import { useT } from '../../i18n';
import { CHAT_OPEN_EVENT } from './ChatLauncher';
import { SUGGESTION_GROUPS } from './suggestions';
import { ChatPanel, type ChatRequest } from './ui/ChatPanel';
import s from './chatbot.module.css';

/** Route "#/chat" — full-page assistant (same engine as the drawer) + suggested questions by topic. */
export default function ChatPage() {
  const t = useT();
  const q = useHashQuery();
  const [request, setRequest] = useState<ChatRequest | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);

  // #/chat?q=… deep link asks immediately (once)
  const initial = q.get('q');
  useEffect(() => {
    if (initial) {
      setRequest({ q: initial, nonce: Date.now() });
      q.set({ q: null }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // openChat({ q }) while on this page
  useEffect(() => {
    const fn = (e: Event) => {
      const text = (e as CustomEvent<{ q?: string }>).detail?.q;
      if (text) setRequest({ q: text, nonce: Date.now() });
    };
    window.addEventListener(CHAT_OPEN_EVENT, fn);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, fn);
  }, []);

  const ask = (text: string) => {
    setRequest({ q: text, nonce: Date.now() });
    setTopicsOpen(false);
  };

  return (
    <div className="container">
      <PageHeader eyebrow={t('pages.chat.eyebrow')} title={t('pages.chat.title')} subtitle={t('pages.chat.subtitle')} />
      <div className={s.page}>
        <aside className={`${s.sidebar} glass`} aria-label={t('chat.ui.suggested')}>
          <button type="button" className={s.sidebarToggle} onClick={() => setTopicsOpen((v) => !v)} aria-expanded={topicsOpen}>
            {topicsOpen ? t('chat.ui.hideTopics') : t('chat.ui.showTopics')}
          </button>
          <div className={`${s.topics} ${topicsOpen ? s.topicsOpen : ''}`}>
            <h2 className={s.sidebarTitle}>{t('chat.ui.suggested')}</h2>
            {SUGGESTION_GROUPS.map((g) => (
              <section key={g.topic} className={s.topic}>
                <h3 className={s.topicTitle}>{t(`chat.topics.${g.topic}`)}</h3>
                <ul className={s.topicList}>
                  {g.keys.map((k) => (
                    <li key={k}>
                      <button type="button" className={s.topicQ} onClick={() => ask(t(`chat.q.${k}`))}>
                        {t(`chat.q.${k}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>
        <section className={`${s.main} glass`} aria-label={t('chat.title')}>
          <ChatPanel variant="page" request={request} />
        </section>
      </div>
    </div>
  );
}
