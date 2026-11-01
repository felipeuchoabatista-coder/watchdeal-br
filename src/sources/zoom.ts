import { extractNextData, type Fetcher } from '../core/http.ts';
import { classify } from '../core/matcher.ts';
import { getModel } from '../core/catalog.ts';
import { decodeEntities, parseBRL } from '../core/text.ts';
import type { HistoryPoint, RawOffer } from '../core/types.ts';
import { canonicalStore, fetchAllTolerant, type ExternalHistory, type Source } from './source.ts';

/**
 * Zoom (zoom.com.br): comparador que reúne Magalu, Amazon, Casas Bahia, Fast Shop e outras.
 * Cada produto do catálogo traz as ofertas por loja e ~40 dias de histórico de preço.
 */

const BASE = 'https://www.zoom.com.br';
const SEARCHES = [
  '/smartwatch/samsung',
  '/search?q=galaxy%20watch%20ultra',
  '/search?q=galaxy%20watch8',
  '/search?q=galaxy%20watch7',
  '/search?q=galaxy%20watch%20fe',
  '/search?q=galaxy%20watch6',
  '/search?q=galaxy%20watch5',
  '/search?q=galaxy%20watch4',
  '/search?q=xiaomi%20watch%202',
  '/search?q=ticwatch',
];
/** Páginas de produto abertas por rodada (cada uma traz ofertas por loja e ~40 dias de histórico). */
const MAX_PRODUCT_PAGES = 28;

interface ZoomHit {
  type: string;
  name: string;
  objectId?: string;
  price?: number;
  url?: string;
  image?: string;
  storeCount?: number;
  merchantName?: string;
  marketplace?: boolean;
  installments?: { amount_months?: number; price?: number; total_value?: number };
}

interface ZoomOffer {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
  numParcels?: number;
  parcelValue?: number;
  totalPrice?: number;
  sellerName?: string;
  merchantId?: string;
  sellerIsMarketplace?: boolean;
  stock?: number;
}

export interface ZoomProductRef {
  name: string;
  path: string;
  price?: number;
}

const leadUrl = (offerId: string) => `${BASE}/lead?oid=${offerId}`;

export function parseZoomSearch(html: string): { products: ZoomProductRef[]; offers: RawOffer[]; items: number } {
  const data = extractNextData<{ props: { initialReduxState: { hits: { hits: ZoomHit[] } } } }>(html);
  const hits = data.props.initialReduxState?.hits?.hits ?? [];
  const products: ZoomProductRef[] = [];
  const offers: RawOffer[] = [];
  for (const h of hits) {
    const name = decodeEntities(h.name ?? '');
    if (h.type === 'product' && h.url) {
      products.push({ name, path: h.url, price: h.price });
    } else if (h.type === 'offer' && h.price) {
      const oid = h.objectId?.replace(/^offer/, '') ?? h.url?.match(/oid=(\d+)/)?.[1];
      if (!oid) continue;
      const total = h.installments?.total_value;
      offers.push({
        source: 'zoom',
        sourceOfferId: oid,
        title: name,
        store: canonicalStore(h.merchantName),
        marketplace: h.marketplace || undefined,
        price: h.price,
        priceCard: total && total > h.price + 0.5 ? total : undefined,
        installments: h.installments?.amount_months && h.installments.price
          ? { n: h.installments.amount_months, value: h.installments.price }
          : undefined,
        url: leadUrl(oid),
        image: h.image,
        available: true,
      });
    }
  }
  return { products, offers, items: hits.length };
}

interface ZoomProductState {
  offers?: { offerList?: ZoomOffer[]; bestOffer?: ZoomOffer };
  products?: { product?: { product?: { id?: string; name?: string } } };
  priceHistory?: { priceHistory?: Record<string, { days?: { date: string; price: number; merchantId: number | string }[] }> };
}

export function parseZoomProduct(html: string, ref: ZoomProductRef): { offers: RawOffer[]; history?: ExternalHistory } {
  const data = extractNextData<{ props: { initialReduxState: ZoomProductState } }>(html);
  const state = data.props.initialReduxState;
  const productName = decodeEntities(state.products?.product?.product?.name ?? ref.name);
  const list = [...(state.offers?.offerList ?? [])];
  if (state.offers?.bestOffer && !list.some((o) => o.id === state.offers?.bestOffer?.id)) list.push(state.offers.bestOffer);

  const merchants = new Map<string, string>();
  const seen = new Set<string>();
  const offers: RawOffer[] = [];
  for (const o of list) {
    if (o.merchantId && o.sellerName) merchants.set(String(o.merchantId), canonicalStore(o.sellerName));
    if (seen.has(o.id) || !o.price) continue;
    seen.add(o.id);
    const total = o.totalPrice;
    offers.push({
      source: 'zoom',
      sourceOfferId: o.id,
      title: decodeEntities(o.name),
      canonicalTitle: productName,
      store: canonicalStore(o.sellerName),
      marketplace: o.sellerIsMarketplace || undefined,
      price: o.price,
      priceCard: total && total > o.price + 0.5 ? total : undefined,
      installments: o.numParcels && o.parcelValue ? { n: o.numParcels, value: o.parcelValue } : undefined,
      url: leadUrl(o.id),
      image: o.imageUrl,
      available: o.stock === undefined || o.stock > 0,
    });
  }

  const histories = state.priceHistory?.priceHistory ?? {};
  const days = Object.values(histories)[0]?.days ?? [];
  const points: HistoryPoint[] = days
    .filter((d) => d.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({ d: d.date, p: parseBRL(d.price) ?? d.price, s: merchants.get(String(d.merchantId)) ?? 'Loja via Zoom', o: 'zoom' as const }));

  return { offers, history: points.length ? { title: productName, points } : undefined };
}

export const zoom: Source = {
  id: 'zoom',
  name: 'Zoom',
  site: 'zoom.com.br',
  everyMinutes: 15,
  async collect(fetcher: Fetcher) {
    const blockMarkers = ['captcha', 'Access Denied'];
    const searches = await fetchAllTolerant(
      SEARCHES.map((path) => ({
        label: `busca ${path}`,
        run: async () => parseZoomSearch(await fetcher(BASE + path, { blockMarkers })),
      })),
    );

    // Só abre a página dos produtos que são de fato os relógios rastreados.
    const refs = new Map<string, ZoomProductRef & { primary: boolean }>();
    for (const s of searches.results) {
      for (const p of s.products) {
        const c = classify({ title: p.name, price: p.price });
        if (c.kind !== 'device' || !c.model || refs.has(p.path)) continue;
        refs.set(p.path, { ...p, primary: getModel(c.model).primary });
      }
    }
    const chosen = [...refs.values()]
      .sort((a, b) => Number(b.primary) - Number(a.primary))
      .slice(0, MAX_PRODUCT_PAGES);

    const pages = await fetchAllTolerant(
      chosen.map((ref) => ({
        label: `produto ${ref.path}`,
        run: async () => parseZoomProduct(await fetcher(BASE + ref.path, { blockMarkers }), ref),
      })),
    );

    const offers = [...searches.results.flatMap((s) => s.offers), ...pages.results.flatMap((p) => p.offers)];
    // O histórico do Zoom é por página de produto; se a página mistura modelos, descarta.
    const history: ExternalHistory[] = [];
    const notes: string[] = [];
    for (const page of pages.results) {
      if (!page.history) continue;
      const expected = classify({ title: page.history.title });
      const own = page.offers.map((o) => classify({ title: o.title, price: o.price }));
      const consistent = own.filter((c) => c.kind === 'device' && c.model === expected.model).length;
      if (own.length > 0 && consistent / own.length >= 0.6) history.push(page.history);
      else notes.push(`Histórico ignorado: a página "${page.history.title}" mistura modelos`);
    }
    const items = searches.results.reduce((n, s) => n + s.items, 0) + pages.results.reduce((n, p) => n + p.offers.length, 0);
    return { offers, history, items, warnings: [...searches.warnings, ...pages.warnings], notes };
  },
};
