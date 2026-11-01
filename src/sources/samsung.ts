import { fetchJson, type Fetcher } from '../core/http.ts';
import { round2 } from '../core/text.ts';
import type { RawOffer } from '../core/types.ts';
import { fetchAllTolerant, type Source } from './source.ts';

/**
 * Loja oficial Samsung (shop.samsung.com.br) — plataforma VTEX, catálogo público.
 * O preço no Pix vem da tabela de parcelamento ("Pix" à vista).
 */

const BASE = 'https://shop.samsung.com/br/api/catalog_system/pub/products/search';
const QUERIES = [
  { ft: 'galaxy watch', from: 0, to: 49 },
  { ft: 'galaxy watch', from: 50, to: 99 },
  { ft: 'galaxy watch fe', from: 0, to: 29 },
  { ft: 'galaxy watch4', from: 0, to: 29 },
];

interface VtexInstallment {
  PaymentSystemName: string;
  NumberOfInstallments: number;
  Value: number;
  TotalValuePlusInterestRate: number;
  InterestRate: number;
}

interface VtexProduct {
  productId: string;
  productName: string;
  link: string;
  items: {
    itemId: string;
    name: string;
    images?: { imageUrl: string }[];
    sellers: {
      sellerName?: string;
      commertialOffer: {
        Price: number;
        ListPrice: number;
        AvailableQuantity: number;
        Installments?: VtexInstallment[];
      };
    }[];
  }[];
}

export function parseSamsungProducts(products: VtexProduct[]): RawOffer[] {
  const offers: RawOffer[] = [];
  for (const p of products) {
    let best: RawOffer | undefined;
    for (const item of p.items ?? []) {
      const seller = item.sellers?.[0];
      const co = seller?.commertialOffer;
      if (!co || !co.Price) continue;
      const installments = co.Installments ?? [];
      const pix = installments.find((i) => /pix/i.test(i.PaymentSystemName) && i.NumberOfInstallments === 1);
      const noInterest = installments
        .filter((i) => i.InterestRate === 0 && !/pix/i.test(i.PaymentSystemName))
        .sort((a, b) => b.NumberOfInstallments - a.NumberOfInstallments)[0];
      const cash = pix?.Value && pix.Value < co.Price ? pix.Value : co.Price;
      const available = co.AvailableQuantity > 0;
      const candidate: RawOffer = {
        source: 'samsung',
        sourceOfferId: p.productId,
        title: item.name && !p.productName.includes(item.name) ? `${p.productName} - ${item.name}` : p.productName,
        store: 'Samsung',
        seller: 'Samsung (loja oficial)',
        price: round2(cash),
        priceCard: cash < co.Price ? co.Price : undefined,
        listPrice: co.ListPrice > co.Price ? co.ListPrice : undefined,
        installments: noInterest && noInterest.NumberOfInstallments > 1
          ? { n: noInterest.NumberOfInstallments, value: noInterest.Value }
          : undefined,
        url: p.link,
        image: item.images?.[0]?.imageUrl,
        available,
      };
      // Mantém o SKU (cor) mais barato disponível; sem estoque só se nenhum tiver.
      if (!best || (candidate.available && !best.available) || (candidate.available === best.available && candidate.price < best.price)) {
        best = candidate;
      }
    }
    if (best) offers.push(best);
  }
  return offers;
}

export const samsung: Source = {
  id: 'samsung',
  name: 'Samsung (loja oficial)',
  site: 'shop.samsung.com.br',
  everyMinutes: 10,
  async collect(fetcher: Fetcher) {
    const { results, warnings } = await fetchAllTolerant(
      QUERIES.map((q) => ({
        label: `${q.ft} ${q.from}-${q.to}`,
        run: () => fetchJson<VtexProduct[]>(fetcher, `${BASE}?ft=${encodeURIComponent(q.ft)}&_from=${q.from}&_to=${q.to}`),
      })),
    );
    const byId = new Map<string, VtexProduct>();
    for (const list of results) for (const p of list) byId.set(p.productId, p);
    const products = [...byId.values()];
    return { offers: parseSamsungProducts(products), items: products.length, warnings };
  },
};
