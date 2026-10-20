import { useCallback, type ReactNode } from 'react';
import { HashRouter } from 'react-router-dom';
import { Shell } from '../components/layout/Shell';
import { ToastProvider } from '../components/ui/Toast';
import { useHashQuery } from './hooks/useHashQuery';
import { DataProvider } from './providers/DataProvider';
import { LocaleProvider } from './providers/LocaleProvider';
import { ThemeProvider } from './providers/ThemeProvider';

/** Connects `?theme=` / `?lang=` in the hash query to the providers (router-aware). */
function Providers({ children }: { children: ReactNode }) {
  const q = useHashQuery();
  const urlTheme = q.get('theme');
  const urlLang = q.get('lang');
  // When the user changes theme/lang explicitly, drop the stale URL override.
  const dropTheme = useCallback(() => urlTheme && q.set({ theme: null }), [urlTheme, q]);
  const dropLang = useCallback(() => urlLang && q.set({ lang: null }), [urlLang, q]);
  return (
    <ThemeProvider urlTheme={urlTheme} onUserChange={dropTheme}>
      <LocaleProvider urlLang={urlLang} onUserChange={dropLang}>
        <DataProvider>
          <ToastProvider>{children}</ToastProvider>
        </DataProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <Providers>
        <Shell />
      </Providers>
    </HashRouter>
  );
}
