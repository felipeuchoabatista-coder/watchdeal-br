import type { Fetcher } from '../core/http.ts';
import { couponFromField, extractCouponCode } from '../core/coupons.ts';
import { decodeEntities, spDay } from '../core/text.ts';
import type { RawOffer } from '../core/types.ts';
import { canonicalStore, fetchAllTolerant, type ExternalHistory, type Source } from './source.ts';

/**
 * Pelando — maior comunidade de promoções do Brasil. Ofertas ativas viram
 * ofertas no app (com "temperatura"); as expiradas alimentam o histórico.
 * Os dados vêm das props serializadas do Astro (atributo props do <astro-island>).
 */

const QUERIES = [
  'galaxy-watch', 'galaxy-watch-ultra', 'galaxy-watch-8', 'galaxy-watch-7', 'galaxy-watch-fe', 'galaxy-watch-6', 'galaxy-watch-5',
  'galaxy-watch4', 'xiaomi-watch-2', 'ticwatch',
];

interface PelandoDeal {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  status: string;
  temperature?: number;
  commentCount?: number;
  createdAt?: string;
  firstApprovedAt?: string;
  kind?: string;
  freeShipping?: boolean | null;
  couponCode?: string | null;
  store?: { name?: string } | null;
  imageUrl?: string;
  sourceUrl?: string;
  redirectUrl?: string;
}

/** Decodifica o formato de serialização do Astro: [0, valor] e [1, lista]. */
export function decodeAstro(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    const [tag, inner] = value as [number, unknown];
    if (tag === 0) {
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        return Object.fromEntries(Object.entries(inner).map(([k, v]) => [k, decodeAstro(v)]));
      }
      return inner;
    }
    if (tag === 1 && Array.isArray(inner)) return inner.map(decodeAstro);
    return inner;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeAstro(v)]));
  }
  return value;
}

function findDeals(node: unknown): PelandoDeal[] {
  if (Array.isArray(node)) {
    if (node.length && node[0] && typeof node[0] === 'object' && 'temperature' in node[0] && 'slug' in node[0]) {
      return node as PelandoDeal[];
    }
    return node.flatMap(findDeals);
  }
  if (node && typeof node === 'object') return Object.values(node).flatMap(findDeals);
  return [];
}

export function parsePelandoSearch(html: string): PelandoDeal[] {
  const deals: PelandoDeal[] = [];
  for (const m of html.matchAll(/<astro-island\b[^>]*\sprops="([^"]*)"[^>]*>/g)) {
    if (!m[1].includes('temperature')) continue;
    const props = decodeAstro(JSON.parse(decodeEntities(m[1])));
    deals.push(...findDeals(props));
  }
  if (deals.length === 0 && !/astro-island/.test(html)) throw new Error('Página do Pelando sem dados (layout mudou?)');
  return deals;
}

export function pelandoToResult(deals: PelandoDeal[]): { offers: RawOffer[]; history: ExternalHistory[] } {
  const offers: RawOffer[] = [];
  const history: ExternalHistory[] = [];
  for (const d of deals) {
    if (!d.price || d.price <= 0) continue;
    const title = decodeEntities(d.title ?? '').trim();
    const postedAt = d.firstApprovedAt ?? d.createdAt;
    const store = canonicalStore(d.store?.name);
    if (d.status === 'active') {
      offers.push({
        source: 'pelando',
        sourceOfferId: d.id,
        title,
        store,
        price: d.price,
        coupon: d.couponCode ? couponFromField(d.couponCode, title) : extractCouponCode(title) ? couponFromField(undefined, title) : undefined,
        url: d.redirectUrl || d.sourceUrl || `https://www.pelando.com.br/d/${d.slug}`,
        discussionUrl: `https://www.pelando.com.br/d/${d.slug}`,
        image: d.imageUrl,
        available: true,
        postedAt,
        community: { temperature: d.temperature, comments: d.commentCount },
        freeShipping: d.freeShipping ?? undefined,
      });
    } else if (postedAt) {
      history.push({ title, points: [{ d: spDay(postedAt), p: d.price, s: store, o: 'pelando' }] });
    }
  }
  return { offers, history };
}

export const pelando: Source = {
  id: 'pelando',
  name: 'Pelando',
  site: 'pelando.com.br',
  everyMinutes: 30,
  async collect(fetcher: Fetcher) {
    const { results, warnings } = await fetchAllTolerant(
      QUERIES.map((q) => ({
        label: q,
        run: async () => parsePelandoSearch(await fetcher(`https://www.pelando.com.br/busca/${q}`)),
      })),
    );
    const byId = new Map<string, PelandoDeal>();
    for (const list of results) for (const d of list) byId.set(d.id, d);
    const deals = [...byId.values()];
    return { ...pelandoToResult(deals), items: deals.length, warnings };
  },
};
