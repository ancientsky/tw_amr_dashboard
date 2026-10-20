import { useEffect, useState } from 'react';

/** True below the given viewport width (reactive). Used to tighten chart labels on phones. */
export function useNarrow(maxWidth = 640): boolean {
  const q = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const fn = () => setNarrow(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [q]);
  return narrow;
}
