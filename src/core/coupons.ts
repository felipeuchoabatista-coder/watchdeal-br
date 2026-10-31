import type { CouponRef } from './types.ts';

/** Palavras em caixa alta que aparecem perto de "cupom" mas não são códigos. */
const NOT_CODES = new Set([
  'OFF', 'PIX', 'FRETE', 'GRATIS', 'GRÁTIS', 'APP', 'NO', 'NA', 'DE', 'COM', 'USE', 'CUPOM', 'CODIGO', 'CÓDIGO',
  'DESCONTO', 'AQUI', 'LINK', 'LOJA', 'SITE', 'PRIME', 'MEMBERS', 'BT', 'LTE', 'GPS', 'NFC', 'AI', 'MM', 'GB',
  'AMAZON', 'KABUM', 'MAGALU', 'SHOPEE', 'RELAMPAGO', 'ATIVAR', 'RESGATAR', 'VALIDO', 'VÁLIDO',
]);

const CODE = '([A-Z0-9][A-Z0-9_-]{3,24})';
const CODE_PATTERNS = [
  new RegExp(`cupom(?:\\s+de\\s+desconto)?\\s*[:\\-]?\\s*["“']?${CODE}`, 'gi'),
  new RegExp(`c[óo]digo\\s*[:\\-]?\\s*["“']?${CODE}`, 'gi'),
  new RegExp(`use\\s+(?:o\\s+)?(?:cupom\\s+)?["“']?${CODE}`, 'gi'),
];

function looksLikeCode(candidate: string): boolean {
  if (NOT_CODES.has(candidate.toUpperCase())) return false;
  if (candidate !== candidate.toUpperCase()) return false;
  if (!/[A-Z]/.test(candidate)) return false;
  if (/^\d+$/.test(candidate)) return false;
  return candidate.length >= 4 && candidate.length <= 25;
}

/** Extrai um código de cupom de um texto livre ("Use o cupom RELOGIO100"). */
export function extractCouponCode(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  for (const pattern of CODE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      if (looksLikeCode(m[1])) return m[1];
    }
  }
  return undefined;
}

/** Lê valor ("R$ 120 OFF") ou percentual ("10% OFF") de um texto de cupom. */
export function parseCouponDiscount(text: string | undefined | null): Pick<CouponRef, 'value' | 'percent'> {
  if (!text) return {};
  const pct = /(\d{1,2})\s*%/.exec(text);
  if (pct) return { percent: Number(pct[1]) };
  const val = /R\$\s*(\d{1,4}(?:[.,]\d{2})?)/i.exec(text);
  if (val) return { value: Number(val[1].replace(',', '.')) };
  return {};
}

const IRRELEVANT = /(placa[- ]?m[aã]e|headsets?|mouses?|teclados?|cadeiras?|mesas? gamer|consoles?|\bgames?\b|notebooks?|monitor|\btvs?\b|geladeira|fog[aã]o|ar[- ]condicionado|lavadora|moda|roupa|t[eê]nis|beleza|perfum|cosm[eé]tic|livros?|brinquedo|supermercado|mercado\b|\bpet\b|m[oó]veis|colch[aã]o|ferrament|automotiv|pneu|bebida|vinho|cerveja|aliment|farm[aá]cia|suplemento|placa de v[ií]deo|\bssd\b|mem[oó]rias?|processador|impressora|eletrodom[eé]stic|cozinha|panela|fralda|celulares|smartphones?|iphone|\bgalaxy (s|z|a)\d|ingresso|viage|hotel|passage|restaurante|delivery|corrida|casa conectada|coffee|caf[eé]|decora|cama|banho|jardim|esporte|academia|infantil|beb[eê])/i;
const WEARABLE = /(smartwatch|smartwatches|rel[oó]gio|wearable|galaxy watch|xiaomi watch|vest[ií]veis)/i;
const STOREWIDE = /(todo o site|todo site|site todo|em todo|qualquer|seus pedidos|em pedidos|pedidos acima|primeira compra|compras? acima|acima de r\$|em compras|no app|pelo app|loja toda|toda a loja|produtos selecionados|eletr[oô]nicos|tecnologia|produtos samsung|linha galaxy)/i;

export type CouponScope = 'modelo' | 'smartwatch' | 'loja';

/**
 * Decide se um cupom de loja interessa a quem quer um dos relógios.
 * Cupom de placa-mãe, cadeira gamer etc. é descartado (undefined).
 */
export function couponScope(text: string, store: string, mentionsModel: boolean, code = ''): CouponScope | undefined {
  if (mentionsModel) return 'modelo';
  if (WEARABLE.test(text)) return 'smartwatch';
  // O próprio código costuma entregar a categoria (MODAFULL, moveis8...).
  if (IRRELEVANT.test(text) || IRRELEVANT.test(code.replace(/\d+/g, ' '))) return undefined;
  if (STOREWIDE.test(text)) return 'loja';
  // Na loja oficial dos fabricantes, cupom genérico normalmente vale para relógios.
  if (/^(samsung|xiaomi)$/i.test(store)) return 'loja';
  return undefined;
}

/**
 * Normaliza o campo de cupom das comunidades: às vezes é o código
 * ("RELOGIO100"), às vezes uma descrição ("Cupom R$120 Off").
 */
export function couponFromField(field: string | undefined | null, context?: string): CouponRef | undefined {
  const raw = field?.trim();
  if (raw && /^[A-Z0-9][A-Z0-9_-]{3,24}$/.test(raw) && looksLikeCode(raw)) {
    return { code: raw, ...parseCouponDiscount(context) };
  }
  const code = extractCouponCode(raw) ?? extractCouponCode(context);
  if (!raw && !code) return undefined;
  return { code, description: raw || undefined, ...parseCouponDiscount(raw || context) };
}
