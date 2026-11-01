import { fetchJson, type Fetcher } from '../core/http.ts';
import { parseBRL } from '../core/text.ts';
import type { RawOffer } from '../core/types.ts';
import { fetchAllTolerant, type Source } from './source.ts';

/**
 * KaBuM! — API pública do catálogo usada pelo próprio site.
 * price_with_discount é o preço no Pix; "offer" é a Oferta Ninja (relâmpago).
 */

const API = 'https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products';
const QUERIES = ['galaxy watch', 'galaxy watch fe', 'galaxy watch4', 'xiaomi watch 2'];

interface KabumItem {
  id: number;
  attributes: {
    title: string;
    price: number;
    price_with_discount?: number;
    old_price?: number;
    available: boolean;
    is_openbox?: boolean;
    product_link?: string;
    images?: string[];
    max_installment?: string;
    marketplace?: { seller_name?: string } | null;
    offer?: {
      price?: number;
      price_with_discount?: number;
      ends_at?: number | string;
      end_date?: number | string;
    } | null;
  };
}

function toIso(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  const date = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseKabum(items: KabumItem[]): RawOffer[] {
  return items.map((it): RawOffer => {
    const a = it.attributes;
    const offer = a.offer ?? undefined;
    const card = offer?.price ?? a.price;
    const pix = offer?.price_with_discount ?? a.price_with_discount ?? card;
    const sellerName = a.marketplace?.seller_name?.trim();
    const thirdParty = Boolean(sellerName && !/kabum/i.test(sellerName));
    const inst = a.max_installment?.match(/(\d+)x de R\$\s*([\d.,]+)/i);
    return {
      source: 'kabum',
      sourceOfferId: String(it.id),
      title: a.title,
      store: 'KaBuM!',
      seller: sellerName || 'KaBuM!',
      marketplace: thirdParty || undefined,
      price: pix,
      priceCard: card > pix + 0.5 ? card : undefined,
      listPrice: a.old_price && a.old_price > card ? a.old_price : undefined,
      installments: inst ? { n: Number(inst[1]), value: parseBRL(inst[2]) ?? 0 } : undefined,
      url: `https://www.kabum.com.br/produto/${it.id}${a.product_link ? `/${a.product_link}` : ''}`,
      image: a.images?.[0],
      available: a.available,
      conditionHint: a.is_openbox ? 'recondicionado' : undefined,
      endsAt: toIso(offer?.ends_at ?? offer?.end_date),
    };
  });
}

export const kabum: Source = {
  id: 'kabum',
  name: 'KaBuM!',
  site: 'kabum.com.br',
  everyMinutes: 10,
  async collect(fetcher: Fetcher) {
    const { results, warnings } = await fetchAllTolerant(
      QUERIES.map((q) => ({
        label: q,
        run: () => fetchJson<{ data: KabumItem[] }>(fetcher, `${API}?query=${encodeURIComponent(q)}&page_size=100&page_number=1`),
      })),
    );
    const byId = new Map<number, KabumItem>();
    for (const r of results) for (const it of r.data ?? []) byId.set(it.id, it);
    const items = [...byId.values()];
    return { offers: parseKabum(items), items: items.length, warnings };
  },
};
