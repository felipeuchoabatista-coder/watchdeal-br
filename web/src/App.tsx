import { useEffect, useState } from 'react';
import { MODELS } from '../../src/core/catalog.ts';
import type { ModelId } from '../../src/core/types.ts';
import { Icon } from './components/Icon.tsx';
import { InstallBanner } from './components/InstallBanner.tsx';
import { ago, useAppData } from './data.ts';
import { Alerts } from './pages/Alerts.tsx';
import { Coupons } from './pages/Coupons.tsx';
import { Home } from './pages/Home.tsx';
import { ModelPage } from './pages/ModelPage.tsx';
import { Sources } from './pages/Sources.tsx';
import { usePrefs } from './prefs.ts';

type Route = { name: 'home' } | { name: 'modelo'; model: ModelId } | { name: 'cupons' } | { name: 'alertas' } | { name: 'fontes' };

function parseHash(hash: string): Route {
  const [, page, arg] = hash.replace(/^#/, '').split('/');
  if (page === 'modelo' && MODELS.some((m) => m.id === arg)) return { name: 'modelo', model: arg as ModelId };
  if (page === 'cupons') return { name: 'cupons' };
  if (page === 'alertas') return { name: 'alertas' };
  if (page === 'fontes') return { name: 'fontes' };
  return { name: 'home' };
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function freshness(iso: string | undefined, now: number): 'ok' | 'late' | 'stale' {
  if (!iso) return 'stale';
  const min = (now - new Date(iso).getTime()) / 60_000;
  return min <= 45 ? 'ok' : min <= 180 ? 'late' : 'stale';
}

const NAV = [
  { href: '#/', name: 'home', label: 'Ofertas', icon: 'tag' },
  { href: '#/cupons', name: 'cupons', label: 'Cupons', icon: 'ticket' },
  { href: '#/alertas', name: 'alertas', label: 'Alertas', icon: 'bell' },
  { href: '#/fontes', name: 'fontes', label: 'Fontes', icon: 'pulse' },
] as const;

export function App() {
  const route = useRoute();
  const now = useNow();
  const [prefs, setPrefs] = usePrefs();
  const { data, error, loading, reload } = useAppData();
  const fresh = freshness(data?.snapshot.generatedAt, now);
  const active = route.name === 'modelo' ? 'home' : route.name;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="WatchDeal — início">
          <img src="./icons/icon-192.png" alt="" width={28} height={28} />
          <span>WatchDeal<small>BR</small></span>
        </a>
        <button type="button" className={`fresh fresh--${fresh}`} onClick={() => void reload()} title="Atualizar agora">
          <span className="fresh__dot" aria-hidden />
          {loading && !data ? 'Carregando…' : data ? `Atualizado ${ago(data.snapshot.generatedAt, now)}` : 'Sem dados'}
          <Icon name="refresh" size={14} />
        </button>
      </header>

      <main className="main" id="conteudo">
        {fresh === 'stale' && data && (
          <div className="banner banner--warn" role="status">
            Os dados não são atualizados {ago(data.snapshot.generatedAt, now)}. O agendamento do GitHub pode estar pausado — veja a aba Fontes.
          </div>
        )}
        {error && !data && (
          <div className="banner banner--error" role="alert">
            Não foi possível carregar as ofertas ({error}). Verifique a conexão e toque em “Atualizar”.
          </div>
        )}
        {!data && !error && <div className="skeleton" aria-busy="true" aria-label="Carregando ofertas" />}
        {data && route.name === 'home' && <Home data={data} prefs={prefs} setPrefs={setPrefs} now={now} />}
        {data && route.name === 'modelo' && <ModelPage key={route.model} model={route.model} data={data} prefs={prefs} setPrefs={setPrefs} now={now} />}
        {data && route.name === 'cupons' && <Coupons data={data} now={now} />}
        {data && route.name === 'alertas' && <Alerts data={data} now={now} />}
        {data && route.name === 'fontes' && <Sources data={data} prefs={prefs} setPrefs={setPrefs} now={now} />}
        <InstallBanner />
      </main>

      <nav className="bottomnav" aria-label="Navegação principal">
        {NAV.map((n) => (
          <a key={n.name} href={n.href} className={active === n.name ? 'is-on' : ''} aria-current={active === n.name ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
