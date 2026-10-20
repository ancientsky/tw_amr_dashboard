import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Fullscreen API on an element with a graceful fallback flag: when the API is missing
 * (e.g. iOS Safari) `fallback` becomes true and the caller renders a full-viewport modal.
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const fn = () => setNative(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, [ref]);

  const enter = useCallback(async () => {
    const el = ref.current;
    if (el && document.fullscreenEnabled && el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        return;
      } catch {
        /* fall back */
      }
    }
    setFallback(true);
  }, [ref]);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setFallback(false);
  }, []);

  return { active: native || fallback, native, fallback, enter, exit, toggle: () => (native || fallback ? exit() : enter()) };
}
