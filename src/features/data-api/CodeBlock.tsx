import { useState } from 'react';
import { Button } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { copyText } from '../../lib/download';
import s from './dataApi.module.css';

/** Monospace snippet with a Copy button (clipboard with textarea fallback). */
export function CodeBlock({ code, label, wrap }: { code: string; label: string; wrap?: boolean }) {
  const t = useT();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const copy = async () => {
    const ok = await copyText(code);
    if (ok) {
      setDone(true);
      toast(t('actions.copied'));
      window.setTimeout(() => setDone(false), 1800);
    }
  };
  return (
    <div className={s.code}>
      <Button
        variant="ghost"
        icon={done ? 'check' : 'copy'}
        onClick={copy}
        className={s.codeCopy}
        aria-label={`${t('actions.copy')}: ${label}`}
      >
        {done ? t('actions.copied') : t('actions.copy')}
      </Button>
      <pre className={[s.pre, wrap ? s.preWrap : ''].join(' ')} tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Small icon-only copy control for URLs. */
export function useCopy() {
  const t = useT();
  const toast = useToast();
  return async (text: string) => {
    const ok = await copyText(text);
    if (ok) toast(t('actions.copied'));
  };
}
