import type { ModelSpec } from './catalog.ts';

/**
 * Atalhos para buscar o modelo em lojas que o coletor não lê direto.
 * Ordenar por menor preço sem piso traz pulseira de R$ 15 no topo, então só
 * ordena por preço onde a loja aceita também um preço mínimo na URL (o piso
 * plausível do modelo). Nas outras, o atalho é a busca comum da loja.
 */

export interface StoreLink {
  store: string;
  url: string;
  /** Busca aberta já do menor para o maior preço, a partir de `floor`. */
  sortedByPrice: boolean;
  /** Preço mínimo aplicado na busca, em reais. */
  floor?: number;
}

/** Texto de busca do modelo, com tamanho e LTE quando a variante pede. */
export function searchText(spec: ModelSpec, variant?: string): string {
  const [size, conn] = (variant ?? '').split('-');
  const parts = [spec.query];
  if (spec.sizes.length > 1 && /^\d{2}mm$/.test(size)) parts.push(size);
  if (conn === 'lte' && spec.connectivities.length > 1) parts.push('LTE');
  return parts.join(' ');
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function storeSearchLinks(spec: ModelSpec, variant?: string): StoreLink[] {
  const text = searchText(spec, variant);
  const q = encodeURIComponent(text);
  const slug = slugify(text);
  const floor = Math.round(spec.plausible.min);
  return [
    {
      store: 'Mercado Livre',
      url: `https://lista.mercadolivre.com.br/${slug}_OrderId_PRICE_PriceRange_${floor}-0_NoIndex_True`,
      sortedByPrice: true,
      floor,
    },
    {
      store: 'Amazon',
      url: `https://www.amazon.com.br/s?k=${q}&s=price-asc-rank&rh=p_36%3A${floor * 100}-`,
      sortedByPrice: true,
      floor,
    },
    {
      store: 'Google Shopping',
      url: `https://www.google.com/search?tbm=shop&q=${q}&tbs=p_ord%3Ap%2Cmr%3A1%2Cprice%3A1%2Cppr_min%3A${floor}`,
      sortedByPrice: true,
      floor,
    },
    { store: 'Magazine Luiza', url: `https://www.magazineluiza.com.br/busca/${text.replace(/\s+/g, '+')}/`, sortedByPrice: false },
    { store: 'Casas Bahia', url: `https://www.casasbahia.com.br/${slug}/b`, sortedByPrice: false },
    { store: 'KaBuM!', url: `https://www.kabum.com.br/busca/${slug}`, sortedByPrice: false },
    { store: 'Shopee', url: `https://shopee.com.br/search?keyword=${q}`, sortedByPrice: false },
  ];
}

/** A oferta mais barata de cada loja, da loja mais barata para a mais cara. */
export function cheapestByStore<T extends { store: string; price: number }>(offers: T[]): T[] {
  const best = new Map<string, T>();
  for (const o of offers) {
    const current = best.get(o.store);
    if (!current || o.price < current.price) best.set(o.store, o);
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}
