import { useMemo, useState, type CSSProperties } from 'react';
import { MODELS, getModel, variantLabel } from '../../../src/core/catalog.ts';
import { dollarOn } from '../../../src/core/dolar.ts';
import type { ModelId, Offer } from '../../../src/core/types.ts';
import { Chip, Empty, ScoreBadge } from '../components/bits.tsx';
import { OfferCard } from '../components/cards.tsx';
import { Icon } from '../components/Icon.tsx';
import { PriceChart } from '../components/PriceChart.tsx';
import { brl, dateBR, pct, useHistory, type AppData } from '../data.ts';
import { pct2, rate2 } from '../dolar.ts';
import type { Prefs } from '../prefs.ts';
import { sortOffers } from './Home.tsx';

const RANGES = [
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: 'all', label: 'Tudo', days: Infinity },
] as const;

export function ModelPage({ model, data, prefs, setPrefs, now }: { model: ModelId; data: AppData; prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; now: number }) {
  const spec = getModel(model);
  const summary = data.snapshot.summary.find((s) => s.model === model);
  const history = useHistory(model, data.snapshot.generatedAt);
  const offers = useMemo(
    () => sortOffers(data.snapshot.offers.filter((o) => o.model === model && o.available && (prefs.includeUsed || o.condition === 'novo')), 'preco'),
    [data.snapshot, model, prefs.includeUsed],
  );

  const variants = useMemo(() => {
    const keys = new Set<string>([...Object.keys(history?.variants ?? {}), ...(summary?.variants.map((v) => v.variant) ?? [])]);
    return [...keys].sort();
  }, [history, summary]);
  const defaultVariant = summary?.variants.find((v) => v.current)?.variant ?? variants[0];
  const [picked, setPicked] = useState<string | undefined>();
  const variant = picked && variants.includes(picked) ? picked : defaultVariant;
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90');

  const stats = summary?.variants.find((v) => v.variant === variant);
  const series = (variant && history?.variants[variant]) || [];
  const days = RANGES.find((r) => r.id === range)!.days;
  const cutoff = Number.isFinite(days) ? new Date(now - days * 86_400_000).toISOString().slice(0, 10) : '';
  const shown = series.filter((p) => p.d >= cutoff);
  const variantOffers = offers.filter((o) => o.variant === variant);
  const best: Offer | undefined = variantOffers.find((o) => o.condition === 'novo');
  const target = prefs.targets[model];
  const siblings = MODELS.filter((m) => m.family === spec.family && m.id !== model);

  // Como o dólar andou no mesmo período do gráfico.
  const dollarDaily = data.dollar?.daily;
  const dollarFrom = shown.length > 1 && dollarDaily ? dollarOn(dollarDaily, shown[0].d) : undefined;
  const dollarTo = shown.length > 1 && dollarDaily ? dollarOn(dollarDaily, shown[shown.length - 1].d) : undefined;

  return (
    <div className="page">
      <a className="back" href="#/">
        <Icon name="back" size={18} /> Ofertas
      </a>
      <header className="model-head" style={{ '--accent': spec.color } as CSSProperties}>
        <p className="model-head__brand">{spec.brand} · lançado em {spec.launchYear}</p>
        <h1>{spec.name}</h1>
        {siblings.length > 0 && (
          <p className="model-head__sib">
            Veja também: {siblings.map((s) => <a key={s.id} href={`#/modelo/${s.id}`}>{s.shortName}</a>)}
          </p>
        )}
      </header>

      {variants.length > 1 && (
        <div className="chips" role="group" aria-label="Variante">
          {variants.map((v) => (
            <Chip key={v} active={v === variant} onClick={() => setPicked(v)}>
              {variantLabel(v) || 'Padrão'}
            </Chip>
          ))}
        </div>
      )}

      <section className="stat-row" aria-label="Resumo de preços">
        <div className="stat stat--hero">
          <span className="stat__label">Melhor preço agora</span>
          <span className="stat__value">{stats?.current ? brl(stats.current) : '—'}</span>
          <span className="stat__sub">{best ? <>{best.store} <ScoreBadge score={best.score} /></> : 'sem oferta nova no momento'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Menor em 90 dias</span>
          <span className="stat__value">{stats?.min90 ? brl(stats.min90) : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Mediana 30 dias</span>
          <span className="stat__value">{stats?.median30 ? brl(stats.median30) : '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Menor já registrado</span>
          <span className="stat__value">{stats?.allTimeLow ? brl(stats.allTimeLow.price) : '—'}</span>
          {stats?.allTimeLow && <span className="stat__sub">{dateBR(stats.allTimeLow.date)} · {stats.allTimeLow.store}</span>}
        </div>
        {stats?.trend7d !== undefined && (
          <div className="stat">
            <span className="stat__label">Últimos 7 dias</span>
            <span className={`stat__value ${stats.trend7d < 0 ? 'is-down' : stats.trend7d > 0 ? 'is-up' : ''}`}>{pct(stats.trend7d)}</span>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="h-hist">
        <div className="section-head">
          <h2 id="h-hist" className="section-title">Histórico do menor preço</h2>
          <div className="segmented segmented--sm" role="radiogroup" aria-label="Período">
            {RANGES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={range === r.id} className={range === r.id ? 'is-on' : ''} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          {variantLabel(variant ?? '') || 'Padrão'} · produto novo · menor preço do dia entre todas as lojas. Toque no gráfico para ver cada dia.
        </p>
        {history === null && series.length === 0 ? (
          <div className="chart chart--empty">Carregando histórico…</div>
        ) : (
          <PriceChart points={shown} median30={stats?.median30} target={target} dollar={dollarDaily} label={`Histórico do ${spec.shortName} ${variantLabel(variant ?? '')}`} />
        )}
        {dollarFrom !== undefined && dollarTo !== undefined && (
          <p className="chart-dollar">
            Dólar no período: {rate2(dollarFrom)} → {rate2(dollarTo)}{' '}
            <span className={dollarTo > dollarFrom ? 'is-up' : dollarTo < dollarFrom ? 'is-down' : ''}>({pct2((dollarTo / dollarFrom - 1) * 100)})</span>
          </p>
        )}
      </section>

      <section className="card target" aria-labelledby="h-target">
        <h2 id="h-target" className="section-title">Seu preço-alvo</h2>
        <p className="muted small">Ofertas abaixo do alvo ganham destaque neste aparelho. Para receber notificação, configure o alvo também na aba Alertas.</p>
        <label className="target__field">
          <span>R$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={10}
            placeholder={stats?.min90 ? String(Math.round(stats.min90)) : 'ex.: 1100'}
            value={target ?? ''}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPrefs({ targets: { ...prefs.targets, [model]: e.target.value === '' || !Number.isFinite(v) ? undefined : v } });
            }}
          />
        </label>
      </section>

      <section aria-labelledby="h-moffers">
        <h2 id="h-moffers" className="section-title">Ofertas de {spec.shortName} ({offers.length})</h2>
        {offers.length === 0 ? (
          <Empty title="Nenhuma oferta encontrada agora">O histórico continua sendo registrado a cada coleta.</Empty>
        ) : (
          <div className="offers">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} now={now} target={target} showModel={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
