import { fetchJson, type Fetcher } from '../core/http.ts';
import { couponFromField, couponScope } from '../core/coupons.ts';
import { classify } from '../core/matcher.ts';
import { decodeEntities, shortHash, spDay } from '../core/text.ts';
import type { Coupon, ModelId, RawOffer } from '../core/types.ts';
import { canonicalStore, fetchAllTolerant, type ExternalHistory, type Source, type SourceContext } from './source.ts';

/**
 * Promobit — comunidade de promoções com API pública de busca.
 * Fornece ofertas ativas (muitas com código de cupom), ofertas encerradas
 * (histórico) e o mural de cupons por loja.
 */

const API = 'https://api.promobit.com.br/search/result';
const SITE = 'https://www.promobit.com.br';
const QUERIES = [
  'galaxy watch', 'galaxy watch ultra', 'galaxy watch8', 'galaxy watch7', 'galaxy watch fe', 'galaxy watch6', 'galaxy watch5',
  'galaxy watch4', 'xiaomi watch 2', 'ticwatch',
];
/** Lojas que vendem os modelos rastreados — cupons gerais delas interessam. */
const COUPON_STORES = ['samsung', 'amazon', 'kabum', 'magalu', 'mercado livre', 'xiaomi', 'shopee', 'casas bahia', 'americanas', 'carrefour', 'fast shop', 'aliexpress'];
const COUPONS_EVERY_MS = 60 * 60 * 1000;
/** Ofertas encerradas para alimentar o histórico (uma página por modelo a cada rodada de cupons). */
const FINISHED_EVERY_MS = 6 * 60 * 60 * 1000;

interface PromobitOffer {
  offer_id: number;
  offer_title: string;
  offer_price: number;
  offer_old_price?: number;
  offer_price_type?: string;
  offer_coupon?: string | null;
  offer_published: string;
  offer_slug: string;
  offer_status_name: string;
  offer_photo?: string;
  offer_likes?: number;
  offer_comments?: number;
  store_name: string;
}

interface PromobitCoupon {
  coupon_id: number;
  coupon_code?: string | null;
  coupon_title: string;
  coupon_discount_short?: string;
  coupon_discount_on?: string;
  coupon_until?: string | null;
  coupon_published?: string;
  coupon_status_name?: string;
  coupon_verified?: string | null;
  coupon_url?: string;
  store_name: string;
}

const ACTIVE = new Set(['APPROVED', 'RECENTS', 'TOP_OFFER', 'HIGHLIGHT']);

function photoUrl(path?: string): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${SITE}${path}`;
}

export function parsePromobitOffers(list: PromobitOffer[]): { offers: RawOffer[]; history: ExternalHistory[] } {
  const offers: RawOffer[] = [];
  const history: ExternalHistory[] = [];
  for (const o of list) {
    if (!o.offer_price || o.offer_price <= 0 || o.offer_price_type === 'STARTING_AT') continue;
    const title = decodeEntities(o.offer_title).trim();
    const store = canonicalStore(o.store_name);
    const page = `${SITE}/oferta/${o.offer_slug}/`;
    if (ACTIVE.has(o.offer_status_name)) {
      offers.push({
        source: 'promobit',
        sourceOfferId: String(o.offer_id),
        title,
        store,
        price: o.offer_price,
        listPrice: o.offer_old_price && o.offer_old_price > o.offer_price + 1 ? o.offer_old_price : undefined,
        coupon: couponFromField(o.offer_coupon, title),
        url: page,
        discussionUrl: page,
        image: photoUrl(o.offer_photo),
        available: true,
        postedAt: new Date(o.offer_published).toISOString(),
        community: { likes: o.offer_likes, comments: o.offer_comments },
      });
    } else {
      history.push({ title, points: [{ d: spDay(o.offer_published), p: o.offer_price, s: store, o: 'promobit' }] });
    }
  }
  return { offers, history };
}

function modelsIn(text: string): ModelId[] {
  const c = classify({ title: text });
  return c.kind === 'device' && c.model ? [c.model] : [];
}

export function parsePromobitCoupons(list: PromobitCoupon[], now: Date): Coupon[] {
  const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
  const out: Coupon[] = [];
  for (const c of list) {
    if (!c.coupon_code || c.coupon_status_name === 'EXPIRED' || c.coupon_status_name === 'FINISHED') continue;
    if (c.coupon_until && new Date(c.coupon_until).getTime() <= now.getTime()) continue;
    if (c.coupon_published && now.getTime() - new Date(c.coupon_published).getTime() > maxAgeMs) continue;
    const title = decodeEntities(c.coupon_title).trim();
    const store = canonicalStore(c.store_name);
    const text = `${title} ${c.coupon_discount_on ?? ''}`;
    const models = modelsIn(text);
    const scope = couponScope(text, store, models.length > 0, c.coupon_code);
    if (!scope) continue;
    out.push({
      id: `promobit:${c.coupon_id}`,
      source: 'promobit',
      store,
      code: c.coupon_code.trim(),
      title,
      discount: c.coupon_discount_short || undefined,
      validUntil: c.coupon_until ? new Date(c.coupon_until).toISOString() : undefined,
      publishedAt: c.coupon_published ? new Date(c.coupon_published).toISOString() : undefined,
      verified: Boolean(c.coupon_verified),
      url: c.coupon_url ? `${SITE}${c.coupon_url}` : undefined,
      models,
      scope,
    });
  }
  return out;
}

/** Cupons de oferta (código dentro de uma oferta ativa) também entram no mural. */
export function couponsFromOffers(offers: RawOffer[]): Coupon[] {
  return offers
    .filter((o) => o.coupon?.code)
    .map((o) => ({
      id: `oferta:${o.source}:${o.sourceOfferId}:${shortHash(o.coupon!.code!)}`,
      source: o.source,
      store: o.store,
      code: o.coupon!.code,
      title: o.title,
      discount: o.coupon!.value ? `R$ ${o.coupon!.value} OFF` : o.coupon!.percent ? `${o.coupon!.percent}% OFF` : undefined,
      publishedAt: o.postedAt,
      url: o.discussionUrl ?? o.url,
      models: modelsIn(o.title),
      scope: 'modelo' as const,
    }));
}

export const promobit: Source = {
  id: 'promobit',
  name: 'Promobit',
  site: 'promobit.com.br',
  everyMinutes: 5,
  async collect(fetcher: Fetcher, ctx: SourceContext) {
    const nowMs = ctx.now.getTime();
    const wantFinished = nowMs - Number(ctx.memory.lastFinishedAt ?? 0) > FINISHED_EVERY_MS;
    const wantCoupons = nowMs - Number(ctx.memory.lastCouponsAt ?? 0) > COUPONS_EVERY_MS;

    const offerTasks = QUERIES.map((q) => ({
      label: `ofertas ${q}`,
      run: () => fetchJson<{ offers: PromobitOffer[] }>(fetcher, `${API}/offers?q=${encodeURIComponent(q)}&offer_status_name=APPROVED`),
    }));
    if (wantFinished) {
      offerTasks.push(...QUERIES.map((q) => ({
        label: `encerradas ${q}`,
        run: () => fetchJson<{ offers: PromobitOffer[] }>(fetcher, `${API}/offers?q=${encodeURIComponent(q)}&offer_status_name=FINISHED`),
      })));
    }
    const offerResults = await fetchAllTolerant(offerTasks);

    const byId = new Map<number, PromobitOffer>();
    for (const r of offerResults.results) for (const o of r.offers ?? []) byId.set(o.offer_id, o);
    const parsed = parsePromobitOffers([...byId.values()]);

    let coupons: Coupon[] | undefined;
    const warnings = [...offerResults.warnings];
    if (wantCoupons) {
      const couponResults = await fetchAllTolerant(
        COUPON_STORES.map((store) => ({
          label: `cupons ${store}`,
          run: () => fetchJson<{ coupons: PromobitCoupon[] }>(fetcher, `${API}/coupons?q=${encodeURIComponent(store)}`),
        })),
      ).catch((err) => ({ results: [], warnings: [`cupons: ${err instanceof Error ? err.message : err}`] }));
      warnings.push(...couponResults.warnings);
      if (couponResults.results.length) {
        coupons = parsePromobitCoupons(couponResults.results.flatMap((r) => r.coupons ?? []), ctx.now);
        ctx.memory.lastCouponsAt = nowMs;
      }
    }
    if (wantFinished && offerResults.results.length) ctx.memory.lastFinishedAt = nowMs;

    return {
      offers: parsed.offers,
      history: parsed.history,
      coupons,
      items: byId.size,
      warnings,
    };
  },
};
