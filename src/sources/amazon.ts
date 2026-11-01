import { BlockedError, type Fetcher } from '../core/http.ts';
import { couponFromField } from '../core/coupons.ts';
import { decodeEntities, parseBRL } from '../core/text.ts';
import type { RawOffer } from '../core/types.ts';
import { fetchAllTolerant, type Source } from './source.ts';

/**
 * Amazon Brasil — página pública de busca, em baixa frequência.
 * Se a Amazon mostrar verificação, a fonte fica "bloqueada" (sem contornar).
 */

const QUERIES = [
  'galaxy watch ultra', 'galaxy watch8', 'galaxy watch7', 'galaxy watch fe', 'galaxy watch6', 'galaxy watch5', 'galaxy watch4',
  'xiaomi watch 2', 'ticwatch',
];
const BLOCK_MARKERS = ['validateCaptcha', 'api-services-support@amazon.com', 'Insira os caracteres que você vê'];

function firstMatch(re: RegExp, text: string): string | undefined {
  return re.exec(text)?.[1];
}

export function parseAmazonSearch(html: string): { offers: RawOffer[]; items: number } {
  const blocks = html.split(/data-component-type="s-search-result"/).slice(1);
  // A Amazon às vezes responde 200 com uma página intermediária ("Continuar comprando")
  // em vez da busca: isso é verificação anti-robô, não "zero resultados".
  if (blocks.length === 0) throw new BlockedError('www.amazon.com.br respondeu sem resultados (verificação anti-robô)');
  const offers: RawOffer[] = [];
  for (const raw of blocks) {
    // Corta antes do próximo resultado para não misturar dados.
    const block = raw.slice(0, 60_000);
    const asin = firstMatch(/data-asin="([A-Z0-9]{10})"/, block) ?? firstMatch(/^[^>]*?data-asin="([A-Z0-9]{10})"/, raw);
    const title = firstMatch(/<h2[^>]*aria-label="([^"]+)"/, block)
      ?? firstMatch(/<h2[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/, block);
    if (!asin || !title) continue;

    // Primeiro a-offscreen fora de a-text-price = preço atual; dentro de a-text-price = preço "de".
    const priceMatch = /<span class="a-price"[^>]*>\s*<span class="a-offscreen">([^<]+)<\/span>/.exec(block);
    const price = parseBRL(priceMatch?.[1]);
    if (!price) continue;
    const list = parseBRL(firstMatch(/<span class="a-price a-text-price"[^>]*>\s*<span class="a-offscreen">([^<]+)<\/span>/, block));

    const couponText = firstMatch(/(Economize[^<]{0,40}com cupom[^<]{0,20}|Aplicar cupom[^<]{0,40})/i, block);
    const image = firstMatch(/<img[^>]+class="s-image"[^>]+src="([^"]+)"/, block);
    const unavailable = /Indispon[ií]vel|Atualmente indispon/i.test(block);

    offers.push({
      source: 'amazon',
      sourceOfferId: asin,
      title: decodeEntities(title).replace(/^An[uú]ncio patrocinado\s*[–—-]\s*/i, '').trim(),
      store: 'Amazon',
      price,
      listPrice: list && list > price ? list : undefined,
      coupon: couponText ? { ...couponFromField(undefined, couponText), description: decodeEntities(couponText).trim() } : undefined,
      url: `https://www.amazon.com.br/dp/${asin}`,
      image,
      available: !unavailable,
    });
  }
  return { offers, items: blocks.length };
}

export const amazon: Source = {
  id: 'amazon',
  name: 'Amazon',
  site: 'amazon.com.br',
  everyMinutes: 30,
  async collect(fetcher: Fetcher) {
    const { results, warnings } = await fetchAllTolerant(
      QUERIES.map((q) => ({
        label: q,
        run: async () => parseAmazonSearch(
          await fetcher(`https://www.amazon.com.br/s?k=${encodeURIComponent(q)}`, { blockMarkers: BLOCK_MARKERS, retries: 1 }),
        ),
      })),
    );
    const byAsin = new Map<string, RawOffer>();
    for (const r of results) for (const o of r.offers) if (!byAsin.has(o.sourceOfferId)) byAsin.set(o.sourceOfferId, o);
    return { offers: [...byAsin.values()], items: results.reduce((n, r) => n + r.items, 0), warnings };
  },
};
