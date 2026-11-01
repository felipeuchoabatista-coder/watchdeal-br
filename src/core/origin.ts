import { normalize } from './text.ts';
import type { Origin, RawOffer } from './types.ts';

/**
 * Nacional ou importado? Nenhuma fonte informa isso num campo próprio, então a
 * decisão vem de sinais do anúncio, do mais forte para o mais fraco:
 *  1. loja internacional (AliExpress, Temu…);
 *  2. código Samsung de outro país (sufixo XAA = EUA, EUB = Europa…; ZTO = Brasil);
 *  3. vendedor que se apresenta como importador ("New York Shop", "… Importados");
 *  4. título que diz "versão nacional" (encerra a análise como nacional);
 *  5. título com "versão global", "importado", "envio internacional", "taxas inclusas"…
 * Sem sinal nenhum, a oferta é tratada como nacional.
 */

export interface OriginResult {
  origin: Origin;
  /** Motivo curto, mostrado no app quando a oferta é importada. */
  reason?: string;
}

const INTERNATIONAL_STORES = /^(aliexpress|temu|shein|banggood|dhgate|gearbest|joom|wish|ebay)\b/;

/** Sufixo de região dos códigos Samsung (SM-L330NZKAXAA → XAA). */
const SAMSUNG_SKU = /\bsm-?[lr]\d{3}([a-z])([a-z0-9]{0,8})\b/g;
const SAMSUNG_REGIONS: Record<string, string> = {
  xaa: 'Modelo americano', xar: 'Modelo americano', xac: 'Modelo canadense',
  eub: 'Modelo europeu', eua: 'Modelo europeu', eue: 'Modelo europeu', xeu: 'Modelo europeu',
  xsa: 'Modelo australiano', xsp: 'Modelo asiático', xtc: 'Modelo asiático', ins: 'Modelo indiano',
  kdo: 'Modelo coreano', chn: 'Modelo chinês',
};

const IMPORTER_SELLER = /\b(importad[oa]s?|imports?|importacao|international|internacional|usa|miami|new york|nyc|china|hong kong|exterior|overseas)\b/;

const NATIONAL_TITLE = /\b(versao|produto|modelo)\s+(nacional|brasileir[oa]|brasil)\b|\bhomologado (pela )?anatel\b/;

const IMPORT_TITLE: [RegExp, string][] = [
  [/\b(versao|vers|edicao|modelo)\s+(global|internacional)\b|\bglobal version\b/, 'Versão global'],
  [/\b(versao|vers|edicao|modelo)\s+(chinesa|china|cn)\b|\b(cn|china) version\b/, 'Versão chinesa'],
  [/\b(versao|vers|edicao|modelo)\s+(americana|eua|usa|us)\b|\b(us|usa) version\b/, 'Versão americana'],
  [/\b(versao|vers|edicao|modelo)\s+(europeia|eu)\b|\beu version\b/, 'Versão europeia'],
  [/\b(envio|entrega|frete|compra|loja)\s+internacional\b|\b(enviado|vindo|despachado)\s+do\s+exterior\b|\bdo exterior\b/, 'Enviado do exterior'],
  [/\btaxas?\s+(de importacao\s+)?inclusas?\b|\bimpostos?\s+inclusos?\b|\bremessa conforme\b/, 'Compra internacional (taxas)'],
  [/\bimportad[oa]s?\b/, 'Anunciado como importado'],
  [/^\s*\[?\s*internacional\b|\binternacional\s*\]/, 'Compra internacional'],
  // "Global" solto ("Xiaomi Watch 2 Preto Global") é como o mercado cinza descreve a versão global.
  [/(?<!posicionamento )\bglobal\b/, 'Versão global'],
];

export function detectOrigin(offer: Pick<RawOffer, 'title' | 'store' | 'seller'>): OriginResult {
  const store = normalize(offer.store ?? '');
  const seller = normalize(offer.seller ?? '');
  const title = normalize(offer.title);

  if (INTERNATIONAL_STORES.test(store)) return { origin: 'importado', reason: `Loja internacional (${offer.store})` };

  for (const m of title.matchAll(SAMSUNG_SKU)) {
    const [, letter, tail] = m;
    const region = tail.length >= 3 ? tail.slice(-3) : '';
    if (region === 'zto') return { origin: 'nacional' };
    if (region && SAMSUNG_REGIONS[region]) return { origin: 'importado', reason: `${SAMSUNG_REGIONS[region]} (${m[0].toUpperCase()})` };
    if (letter === 'u') return { origin: 'importado', reason: `Modelo americano (${m[0].toUpperCase()})` };
  }

  if (seller && IMPORTER_SELLER.test(seller)) return { origin: 'importado', reason: `Vendedor importador (${offer.seller})` };

  if (NATIONAL_TITLE.test(title)) return { origin: 'nacional' };
  for (const [re, reason] of IMPORT_TITLE) {
    if (re.test(title)) return { origin: 'importado', reason };
  }
  return { origin: 'nacional' };
}
