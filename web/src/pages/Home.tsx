import { useMemo, useState } from 'react';
import { MODELS, PRIMARY_MODELS, getModel } from '../../../src/core/catalog.ts';
import type { ModelId, Offer } from '../../../src/core/types.ts';
import { Chip, Empty, Toggle } from '../components/bits.tsx';
import { ModelCard, OfferCard } from '../components/cards.tsx';
import { DollarCard } from '../components/DollarCard.tsx';
import { Icon } from '../components/Icon.tsx';
import type { AppData } from '../data.ts';
import type { Prefs } from '../prefs.ts';

const FRESH_MS = 72 * 3_600_000;
const HIDDEN = MODELS.filter((m) => !m.primary).map((m) => m.shortName);
const HIDDEN_HINT = `${HIDDEN.slice(0, -1).join(', ')} e ${HIDDEN.at(-1)}`;

export function visibleOffers(offers: Offer[], prefs: Prefs): Offer[] {
  return offers.filter((o) => {
    if (!prefs.showHidden && !getModel(o.model).primary) return false;
    if (!prefs.includeUsed && o.condition !== 'novo') return false;
    if (prefs.onlyCoupon && !o.coupon?.code) return false;
    return o.available;
  });
}

export function sortOffers(offers: Offer[], sort: Prefs['sort']): Offer[] {
  const list = [...offers];
  if (sort === 'preco') list.sort((a, b) => a.price - b.price);
  else if (sort === 'recentes') list.sort((a, b) => (b.postedAt ?? b.firstSeen).localeCompare(a.postedAt ?? a.firstSeen));
  else list.sort((a, b) => b.score.value - a.score.value || a.price - b.price);
  return list;
}

export function Home({ data, prefs, setPrefs, now }: { data: AppData; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; now: number }) {
  const [model, setModel] = useState<ModelId | 'todos'>('todos');
  const [showFilters, setShowFilters] = useState(false);
  const { snapshot } = data;

  const byId = useMemo(() => new Map(snapshot.offers.map((o) => [o.id, o])), [snapshot]);
  const visible = useMemo(() => visibleOffers(snapshot.offers, prefs), [snapshot, prefs]);
  const filtered = useMemo(
    () => sortOffers(model === 'todos' ? visible : visible.filter((o) => getModel(o.model).family === model), prefs.sort),
    [visible, model, prefs.sort],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of visible) c[getModel(o.model).family] = (c[getModel(o.model).family] ?? 0) + 1;
    return c;
  }, [visible]);

  const fresh = filtered.filter((o) => !o.postedAt || now - new Date(o.postedAt).getTime() <= FRESH_MS);
  const older = filtered.filter((o) => o.postedAt && now - new Date(o.postedAt).getTime() > FRESH_MS);
  const recentEvents = data.events.filter((e) => now - new Date(e.at).getTime() < 48 * 3_600_000).slice(0, 3);

  const cards = (prefs.showHidden ? MODELS : PRIMARY_MODELS).map((m) => {
    const summary = snapshot.summary.find((s) => s.model === m.id);
    return summary ? (
      <ModelCard
        key={m.id}
        summary={summary}
        best={summary.bestOfferId ? byId.get(summary.bestOfferId) : undefined}
        version={snapshot.generatedAt}
      />
    ) : null;
  });

  return (
    <div className="page">
      <DollarCard file={data.dollar} now={now} />

      <section aria-labelledby="h-best">
        <h2 id="h-best" className="section-title">Melhor preço agora</h2>
        <div className="mgrid">{cards}</div>
      </section>

      {recentEvents.length > 0 && (
        <section className="alerts-strip" aria-label="Alertas recentes">
          {recentEvents.map((e) => (
            <a key={e.id} className={`alert-pill alert-pill--${e.type}`} href={e.url ?? '#/alertas'} target={e.url ? '_blank' : undefined} rel="noopener noreferrer">
              <Icon name="bell" size={14} />
              <span>{e.message}</span>
            </a>
          ))}
        </section>
      )}

      <section aria-labelledby="h-offers">
        <div className="section-head">
          <h2 id="h-offers" className="section-title">Ofertas</h2>
          <button type="button" className={`icon-btn${showFilters ? ' is-on' : ''}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <Icon name="filter" size={16} /> Filtros
          </button>
        </div>
        <div className="chips" role="group" aria-label="Filtrar por modelo">
          <Chip active={model === 'todos'} onClick={() => setModel('todos')} count={visible.length}>Todos</Chip>
          {PRIMARY_MODELS.map((m) => (
            <Chip key={m.id} active={model === m.id} onClick={() => setModel(m.id)} count={counts[m.id] ?? 0}>
              {m.shortName.replace('Galaxy ', '')}
            </Chip>
          ))}
        </div>

        {showFilters && (
          <div className="filters">
            <div className="segmented" role="radiogroup" aria-label="Ordenar">
              {([['indice', 'Melhor índice'], ['preco', 'Menor preço'], ['recentes', 'Mais recentes']] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={prefs.sort === v} className={prefs.sort === v ? 'is-on' : ''} onClick={() => setPrefs({ sort: v })}>
                  {label}
                </button>
              ))}
            </div>
            <Toggle checked={prefs.onlyCoupon} onChange={(v) => setPrefs({ onlyCoupon: v })} label="Só ofertas com cupom" />
            <Toggle checked={prefs.includeUsed} onChange={(v) => setPrefs({ includeUsed: v })} label="Incluir usados e recondicionados" />
            <Toggle
              checked={prefs.showHidden}
              onChange={(v) => setPrefs({ showHidden: v })}
              label="Mostrar Classic, Pro e Enduro"
              hint={HIDDEN_HINT}
            />
          </div>
        )}

        {fresh.length === 0 && older.length === 0 ? (
          <Empty title="Nenhuma oferta com esses filtros">
            Tente incluir usados ou outro modelo. O rastreador verifica as lojas a cada 5–30 minutos.
          </Empty>
        ) : (
          <div className="offers">
            {fresh.map((o) => (
              <OfferCard key={o.id} offer={o} now={now} target={prefs.targets[o.model]} />
            ))}
          </div>
        )}
        {older.length > 0 && (
          <details className="older">
            <summary>Ofertas da comunidade com mais de 3 dias ({older.length})</summary>
            <div className="offers">
              {older.map((o) => (
                <OfferCard key={o.id} offer={o} now={now} target={prefs.targets[o.model]} />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
