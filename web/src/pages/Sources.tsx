import type { SourceHealth } from '../../../src/core/types.ts';
import { Icon } from '../components/Icon.tsx';
import { ago, REPO_URL, SOURCE_NAMES, type AppData } from '../data.ts';
import type { Prefs } from '../prefs.ts';

const STATUS: Record<SourceHealth['status'], { label: string; cls: string; icon: string }> = {
  ok: { label: 'Funcionando', cls: 'st--ok', icon: '●' },
  degradado: { label: 'Parcial', cls: 'st--warn', icon: '◐' },
  falhou: { label: 'Falhou', cls: 'st--bad', icon: '✕' },
  bloqueado: { label: 'Bloqueada', cls: 'st--bad', icon: '⛔' },
  aguardando: { label: 'Aguardando', cls: 'st--muted', icon: '○' },
};

const SITE: Record<string, string> = {
  zoom: 'zoom.com.br — compara Magalu, Amazon, Casas Bahia, Fast Shop e outras',
  samsung: 'shop.samsung.com.br — loja oficial',
  kabum: 'kabum.com.br — inclui usados e Oferta Ninja',
  amazon: 'amazon.com.br — busca pública',
  pelando: 'pelando.com.br — comunidade (temperatura)',
  promobit: 'promobit.com.br — comunidade e cupons',
};

export function Sources({ data, prefs, setPrefs, now }: { data: AppData; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; now: number }) {
  const health = data.health;
  return (
    <div className="page">
      <h1 className="page-title">Fontes e ajustes</h1>
      <p className="muted small">
        Última coleta {ago(data.snapshot.generatedAt, now)}
        {health ? ` · rodada levou ${(health.cycleMs / 1000).toFixed(0)}s` : ''}. Cada fonte tem seu intervalo (10–30 min); fontes que bloqueiam acesso automático ficam de fora — o app nunca tenta burlar bloqueios.
      </p>

      <ul className="sources">
        {(health?.sources ?? []).map((s) => {
          const st = STATUS[s.status];
          return (
            <li key={s.source} className="source">
              <div className="source__head">
                <b>{SOURCE_NAMES[s.source]}</b>
                <span className={`st ${st.cls}`}><span aria-hidden>{st.icon}</span> {st.label}</span>
              </div>
              <p className="muted small">{SITE[s.source]}</p>
              <p className="small">
                {s.matched} ofertas dos relógios em {s.items} itens analisados
                {s.lastOkAt ? ` · ok ${ago(s.lastOkAt, now)}` : ''}
                {s.consecutiveFailures > 1 ? ` · ${s.consecutiveFailures} falhas seguidas` : ''}
              </p>
              {s.error && <p className="small source__err">{s.error}</p>}
              {s.notes?.map((n) => <p key={n} className="small muted">{n}</p>)}
            </li>
          );
        })}
      </ul>

      <section className="card">
        <h2 className="section-title">Aparência</h2>
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={prefs.theme === v} className={prefs.theme === v ? 'is-on' : ''} onClick={() => setPrefs({ theme: v })}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Como o Índice de Oferta funciona</h2>
        <ul className="small explain">
          <li><b>50</b> é o preço típico. Cada 1% abaixo da referência soma 2,5 pontos.</li>
          <li>A referência é a <b>mediana de 30 dias</b> — ou a mediana das lojas agora, se for menor (conservador).</li>
          <li><b>+15</b> se for o menor preço em 90 dias; <b>+5</b> se for o menor já registrado.</li>
          <li>Vendedor terceiro de marketplace: <b>−5</b>. Loja oficial/venda direta: <b>+3</b>.</li>
          <li>Sem histórico suficiente, o teto é <b>“Boa”</b> — “Imperdível” exige prova.</li>
          <li>Faixas: 85+ Imperdível · 70+ Ótima · 55+ Boa · 40+ Na média · abaixo, Cara.</li>
        </ul>
      </section>

      <p className="muted small disclaimer">
        Preços e disponibilidade mudam a todo momento; confira sempre na loja. O WatchDeal não vende nada e não tem relação com as lojas.
        {REPO_URL && <> Código aberto: <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub <Icon name="external" size={12} /></a>.</>}
      </p>
    </div>
  );
}
