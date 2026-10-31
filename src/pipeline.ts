import { MODELS, getModel, variantKeyOf, variantOf } from './core/catalog.ts';
import { mergePoint, prune, seriesStats, type SeriesStats } from './core/history.ts';
import { classify } from './core/matcher.ts';
import { scoreOffer } from './core/scoring.ts';
import { median, round2, shortHash, spDay } from './core/text.ts';
import type {
  AlertConfig, Coupon, DealEvent, ModelHistory, ModelId, ModelSummary, Offer, RawOffer, Snapshot, SourceId, VariantStats,
} from './core/types.ts';
import { SOURCE_PRIORITY } from './sources/index.ts';
import type { ExternalHistory } from './sources/source.ts';
import { couponsFromOffers } from './sources/promobit.ts';
import type { CollectorState } from './store.ts';

/** Ofertas de comunidade valem como "preço de agora" só nas primeiras 72h. */
export const COMMUNITY_FRESH_MS = 72 * 60 * 60 * 1000;
/** Depois disso a oferta de comunidade some do app (quase sempre já acabou). */
export const COMMUNITY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Oferta de loja não vista há mais que isso sai do app. */
export const STALE_MS = 6 * 60 * 60 * 1000;

const COMMUNITY: SourceId[] = ['pelando', 'promobit'];

export interface CycleInput {
  now: Date;
  /** Ofertas brutas por fonte; ausente = fonte não rodou (mantém as anteriores). */
  rawBySource: Partial<Record<SourceId, RawOffer[]>>;
  couponsBySource: Partial<Record<SourceId, Coupon[]>>;
  externalHistory: ExternalHistory[];
  previous: Snapshot | null;
  previousCoupons: Coupon[];
  histories: Record<ModelId, ModelHistory>;
  state: CollectorState;
  config: AlertConfig;
}

export interface CycleOutput {
  snapshot: Snapshot;
  coupons: Coupon[];
  histories: Record<ModelId, ModelHistory>;
  events: DealEvent[];
  matchedBySource: Partial<Record<SourceId, number>>;
}

export function isFresh(o: Pick<Offer, 'source' | 'postedAt' | 'available'>, now: Date): boolean {
  if (!o.available) return false;
  if (!COMMUNITY.includes(o.source)) return true;
  return o.postedAt ? now.getTime() - new Date(o.postedAt).getTime() <= COMMUNITY_FRESH_MS : false;
}

type Draft = Omit<Offer, 'score' | 'firstSeen' | 'lastSeen'>;

/**
 * O título do anúncio manda. O nome canônico do Zoom só é usado quando o título
 * da loja não cita modelo nenhum — o Zoom às vezes agrupa um Watch8 dentro da
 * página do Watch4, e confiar no catálogo dele contaminaria o histórico.
 */
export function classifyRaw(raw: Pick<RawOffer, 'title' | 'canonicalTitle' | 'price' | 'conditionHint'>) {
  const own = classify({ title: raw.title, price: raw.price, conditionHint: raw.conditionHint });
  if (own.kind === 'device' || !raw.canonicalTitle) return own;
  if (own.kind !== 'other' || /watch/i.test(raw.title)) return own;
  const canonical = classify({ title: raw.canonicalTitle, price: raw.price, conditionHint: raw.conditionHint });
  return { ...canonical, condition: own.condition !== 'novo' ? own.condition : canonical.condition };
}

function toDraft(raw: RawOffer, now: Date): Draft | undefined {
  if (raw.postedAt && now.getTime() - new Date(raw.postedAt).getTime() > COMMUNITY_MAX_AGE_MS) return undefined;
  const c = classifyRaw(raw);
  if (c.kind !== 'device' || !c.model) return undefined;
  const connectivity = c.connectivity ?? 'bt';
  const variant = variantOf(c.model, c.size, connectivity);
  return {
    ...raw,
    id: `${raw.source}:${raw.sourceOfferId}`,
    model: c.model,
    variant,
    variantKey: variantKeyOf(c.model, variant, c.condition),
    size: c.size,
    connectivity,
    condition: c.condition,
  };
}

/** Une a mesma oferta vista em várias fontes, preservando cupom e sinais da comunidade. */
function dedupe(drafts: Draft[]): Draft[] {
  const groups = new Map<string, Draft[]>();
  for (const d of drafts) {
    const key = `${d.variantKey}|${d.store}|${Math.round(d.price)}`;
    const list = groups.get(key);
    if (list) list.push(d);
    else groups.set(key, [d]);
  }
  const out: Draft[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (SOURCE_PRIORITY.get(a.source) ?? 99) - (SOURCE_PRIORITY.get(b.source) ?? 99));
    const [primary, ...others] = list;
    const merged: Draft = { ...primary };
    for (const o of others) {
      merged.coupon ??= o.coupon;
      merged.discussionUrl ??= o.discussionUrl;
      merged.postedAt ??= o.postedAt;
      merged.community = { ...o.community, ...merged.community };
      merged.endsAt ??= o.endsAt;
      merged.image ??= o.image;
    }
    const alsoOn = others
      .filter((o) => o.source !== primary.source)
      .map((o) => ({ source: o.source, url: o.url, discussionUrl: o.discussionUrl }));
    if (alsoOn.length) merged.alsoOn = alsoOn;
    out.push(merged);
  }
  return out;
}

function emptyHistory(model: ModelId): ModelHistory {
  return { model, updatedAt: '', variants: {} };
}

export function runCycle(input: CycleInput): CycleOutput {
  const { now, config } = input;
  const nowIso = now.toISOString();
  const today = spDay(now);

  // 1. Ofertas: novas das fontes que rodaram + anteriores das que não rodaram.
  const drafts: Draft[] = [];
  const matchedBySource: Partial<Record<SourceId, number>> = {};
  const ranSources = new Set(Object.keys(input.rawBySource) as SourceId[]);
  for (const [source, raws] of Object.entries(input.rawBySource) as [SourceId, RawOffer[]][]) {
    let matched = 0;
    for (const raw of raws) {
      const d = toDraft(raw, now);
      if (d) {
        drafts.push(d);
        matched++;
      }
    }
    matchedBySource[source] = matched;
  }
  for (const prev of input.previous?.offers ?? []) {
    if (ranSources.has(prev.source)) continue;
    if (now.getTime() - new Date(prev.lastSeen).getTime() > STALE_MS) continue;
    if (prev.postedAt && now.getTime() - new Date(prev.postedAt).getTime() > COMMUNITY_MAX_AGE_MS) continue;
    const { score: _score, firstSeen: _f, lastSeen: _l, alsoOn: _a, ...rest } = prev;
    drafts.push(rest);
  }
  const offersDraft = dedupe(drafts);

  // 2. Histórico: importa séries externas e registra o menor preço de hoje.
  const histories: Record<string, ModelHistory> = {};
  for (const m of MODELS) histories[m.id] = structuredClone(input.histories[m.id] ?? emptyHistory(m.id));
  const addPoint = (model: ModelId, variant: string, point: ModelHistory['variants'][string][number]) => {
    const h = histories[model];
    h.variants[variant] = mergePoint(h.variants[variant] ?? [], point);
  };
  for (const ext of input.externalHistory) {
    const c = classify({ title: ext.title, conditionHint: ext.conditionHint });
    if (c.kind !== 'device' || !c.model || c.condition !== 'novo') continue;
    const variant = variantOf(c.model, c.size, c.connectivity ?? 'bt');
    for (const p of ext.points) {
      if (p.d > today) continue;
      const spec = getModel(c.model);
      if (p.p < spec.plausible.min || p.p > spec.plausible.max) continue;
      addPoint(c.model, variant, p);
    }
  }
  for (const o of offersDraft) {
    if (o.condition !== 'novo') continue;
    if (isFresh(o, now)) {
      addPoint(o.model, o.variant, { d: today, p: o.price, s: o.store, o: 'coleta' });
    } else if (o.postedAt && COMMUNITY.includes(o.source)) {
      // Oferta antiga de comunidade conta só no dia em que foi publicada.
      addPoint(o.model, o.variant, { d: spDay(o.postedAt), p: o.price, s: o.store, o: o.source as 'pelando' | 'promobit' });
    }
  }
  for (const h of Object.values(histories)) {
    for (const v of Object.keys(h.variants)) h.variants[v] = prune(h.variants[v], today);
    h.updatedAt = nowIso;
  }

  // 3. Referências por variante (histórico + mediana de mercado agora).
  const statsByKey = new Map<string, SeriesStats>();
  const marketByKey = new Map<string, number[]>();
  for (const o of offersDraft) {
    if (!isFresh(o, now)) continue;
    const list = marketByKey.get(o.variantKey) ?? [];
    list.push(o.price);
    marketByKey.set(o.variantKey, list);
  }
  const refFor = (o: Draft) => {
    if (!statsByKey.has(o.variantKey)) {
      const series = o.condition === 'novo' ? histories[o.model].variants[o.variant] ?? [] : [];
      statsByKey.set(o.variantKey, seriesStats(series, today));
    }
    const s = statsByKey.get(o.variantKey)!;
    const market = marketByKey.get(o.variantKey) ?? [];
    return {
      median30: s.median30,
      min90: s.min90,
      allTimeLow: s.allTimeLow?.price,
      marketMedian: market.length >= 3 ? median(market) : undefined,
      days: s.days,
    };
  };

  // 4. Pontuação e datas.
  const offers: Offer[] = offersDraft.map((d) => {
    const seen = input.state.offersSeen[d.id];
    return {
      ...d,
      firstSeen: seen?.firstSeen ?? nowIso,
      lastSeen: ranSources.has(d.source) ? nowIso : input.previous?.offers.find((p) => p.id === d.id)?.lastSeen ?? nowIso,
      score: scoreOffer(d, refFor(d)),
    };
  });
  offers.sort((a, b) => b.score.value - a.score.value || a.price - b.price);

  // 5. Resumo por modelo.
  const summary: ModelSummary[] = MODELS.map((m) => {
    const mine = offers.filter((o) => o.model === m.id);
    const freshNew = mine.filter((o) => o.condition === 'novo' && isFresh(o, now));
    const best = [...freshNew].sort((a, b) => a.price - b.price)[0];
    const keys = new Set([
      ...Object.keys(histories[m.id].variants).map((v) => variantKeyOf(m.id, v, 'novo')),
      ...freshNew.map((o) => o.variantKey),
    ]);
    const variants: VariantStats[] = [...keys].map((key): VariantStats => {
      const [, variant] = key.split('|');
      const s = seriesStats(histories[m.id].variants[variant] ?? [], today);
      const current = freshNew.filter((o) => o.variantKey === key).sort((a, b) => a.price - b.price)[0];
      return {
        variantKey: key,
        model: m.id,
        variant,
        condition: 'novo',
        current: current?.price,
        currentOfferId: current?.id,
        min90: s.min90,
        median30: s.median30,
        allTimeLow: s.allTimeLow,
        trend7d: s.trend7d,
        days: s.days,
      };
    }).sort((a, b) => (a.current ?? Infinity) - (b.current ?? Infinity));
    const offersCount = mine.filter((o) => o.available).length;
    return { model: m.id, bestOfferId: best?.id, bestPrice: best?.price, offersCount, variants };
  });

  // 6. Cupons: substitui os das fontes que trouxeram cupons; inclui códigos vindos das ofertas.
  const couponSources = new Set(Object.keys(input.couponsBySource));
  const coupons = new Map<string, Coupon>();
  for (const c of input.previousCoupons) {
    if (c.id.startsWith('oferta:')) continue;
    if (!couponSources.has(c.source)) coupons.set(c.id, c);
  }
  for (const list of Object.values(input.couponsBySource)) for (const c of list ?? []) coupons.set(c.id, c);
  for (const c of couponsFromOffers(offers.filter((o) => isFresh(o, now)))) coupons.set(c.id, c);
  const scopeRank = { modelo: 0, smartwatch: 1, loja: 2 } as const;
  const couponList = [...coupons.values()]
    .filter((c) => c.scope)
    .sort((a, b) => scopeRank[a.scope] - scopeRank[b.scope] || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  // 7. Eventos (base dos alertas).
  const events = detectEvents(offers, input, now, couponList);

  // 8. Atualiza o estado de ofertas vistas.
  const offersSeen: CollectorState['offersSeen'] = {};
  for (const o of offers) offersSeen[o.id] = { firstSeen: o.firstSeen, lastSeen: o.lastSeen, price: o.price };
  input.state.offersSeen = offersSeen;

  return {
    snapshot: { generatedAt: nowIso, offers, summary },
    coupons: couponList,
    histories: histories as Record<ModelId, ModelHistory>,
    events,
    matchedBySource,
  };
}

function brl(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function detectEvents(offers: Offer[], input: CycleInput, now: Date, coupons: Coupon[]): DealEvent[] {
  const { config, state } = input;
  const at = now.toISOString();
  const events: DealEvent[] = [];
  const add = (e: Omit<DealEvent, 'id' | 'at'>, key: string) => {
    events.push({ ...e, id: shortHash(key), at });
  };

  for (const o of offers) {
    if (!isFresh(o, now)) continue;
    if (o.condition !== 'novo' && !config.incluirUsados) continue;
    if (!getModel(o.model).primary && !config.incluirVariantesOcultas) continue;
    const spec = getModel(o.model);
    const base = { model: o.model, offerId: o.id, title: o.title, price: o.price, store: o.store, url: o.url };
    const priceKey = Math.round(o.price);

    if (config.alertarNovoMinimo && o.condition === 'novo' && o.score.reasons.includes('Menor preço dos últimos 90 dias')) {
      add({ ...base, type: 'novo-minimo', message: `${spec.shortName}: menor preço em 90 dias — ${brl(o.price)} na ${o.store}` }, `min|${o.variantKey}|${priceKey}`);
    }
    const target = config.alvos[o.model];
    if (target && o.price <= target) {
      add({ ...base, type: 'abaixo-alvo', message: `${spec.shortName} abaixo do seu alvo (${brl(target)}): ${brl(o.price)} na ${o.store}` }, `alvo|${o.id}|${priceKey}`);
    }
    if (o.score.value >= config.indiceMinimo) {
      add({ ...base, type: 'imperdivel', message: `${o.score.label} (${o.score.value}/100): ${spec.shortName} por ${brl(o.price)} na ${o.store}` }, `top|${o.id}|${priceKey}`);
    }
    const seen = state.offersSeen[o.id];
    if (seen && o.price <= seen.price * 0.95 && o.score.value >= 55) {
      const drop = round2((1 - o.price / seen.price) * 100);
      add({ ...base, type: 'queda-preco', message: `${spec.shortName} caiu ${drop}%: ${brl(seen.price)} → ${brl(o.price)} na ${o.store}` }, `queda|${o.id}|${priceKey}`);
    }
  }

  const previousIds = new Set(input.previousCoupons.map((c) => c.id));
  for (const c of coupons) {
    if (previousIds.has(c.id) || c.models.length === 0 || !c.code) continue;
    if (!c.models.some((m) => getModel(m).primary || config.incluirVariantesOcultas)) continue;
    add({
      type: 'cupom-novo',
      model: c.models[0],
      title: c.title,
      store: c.store,
      url: c.url,
      message: `Cupom ${c.code} na ${c.store}: ${c.title}`,
    }, `cupom|${c.id}`);
  }
  return events;
}
