import { MODELS, getModel } from './catalog.ts';
import { normalize } from './text.ts';
import type { Classification, Condition, Connectivity, ModelId } from './types.ts';

/**
 * Identifica, a partir do título de um anúncio, se é um dos relógios rastreados
 * e qual variante. A regra de ouro: na dúvida, NÃO classificar como relógio —
 * uma pulseira de R$ 40 tratada como "Galaxy Watch8" destruiria o histórico.
 */

const ACCESSORY_WORDS = [
  'pulseira', 'pulseiras', 'correia', 'bracelete', 'pelicula', 'peliculas', 'vidro temperado', 'hidrogel',
  'capa', 'capinha', 'case', 'bumper', 'protetor', 'protecao de tela', 'carregador', 'cabo', 'base de carregamento',
  'dock', 'suporte', 'adaptador', 'fecho', 'fivela', 'strap', 'moldura', 'bezel', 'aro ', 'estojo', 'kit pulseira',
  'film', 'mostrador', 'garantia estendida', 'samsung care', 'seguro',
];

/** Palavras que, logo no começo do título, indicam acessório. */
const ACCESSORY_START = /^(\d+\s*(x|un|unid|pcs?)?\s+)?(kit\s+(de\s+)?)?(\d+\s+)?(pulseira|pulseiras|correia|bracelete|pelicula|peliculas|capa|capinha|case|bumper|protetor|carregador|cabo|base|dock|suporte|adaptador|fecho|fivela|vidro|strap|moldura|bezel|aro|estojo|film|garantia|samsung care)\b/;

/** Anúncio "para"/"compatível com" o relógio: acessório ou genérico. */
const FOR_DEVICE = /\b(compativel|compatível|compat\.?|p\/|para\s+(o\s+|os\s+|relogio\s+|smartwatch\s+)?(samsung\s+)?(galaxy|xiaomi|mi\s+watch|watch)|for\s+(samsung\s+)?galaxy)\b/;

/** Sinais típicos de relógio genérico que usa o nome do original. */
const CLONE_WORDS = /\b(similar|replica|réplica|tipo galaxy|estilo|linha premium|hw\d+|w\d{2}\s*(pro|max|mini|ultra)?|gs\d+|x8 ultra|dt\s?\d+|iwo|microwear|lnd|smart watch band|serie \d+|series \d+|haylou|mibro|kieslect|imilab|colmi|lige|blulory|amazfit|huawei|apple|garmin|relogio inteligente)\b/;

const BUNDLE = /(\s\+\s|\+\s*(galaxy|watch|buds)|\bcombo\b|\bkit\s+(smartphone|celular|galaxy)|\bgalaxy\s+(a|s|z|m)\s?\d{1,2}\b|\bgalaxy\s+z\s+(fold|flip)|\bbuds\b|\bsmartphone\b|\btablet\b|\bgalaxy\s+tab\b)/;

const USED = /\b(usado|usados|seminovo|semi\s*novo|marcas de uso|excelente estado|bom estado|estado de novo|ótimo estado|otimo estado)\b|(-\s*(bom|muito bom|excelente|regular)\s*\.?$)/;
const REFURB = /\b(recondicionado|recondicionados|refurbished|recertificado|vitrine|open\s*box|mostruario|reembalado)\b/;

const LTE = /\b(lte|4g|esim|e-sim|celular\s+integrado)\b/;
const BT = /\b(bt|bluetooth|wi-?fi|gps)\b/;

interface ModelHit {
  model: ModelId;
  start: number;
}

/** Converte "watch8"/"watch-8"/"watch 8" em "watch 8" e remove símbolos que atrapalham as regras. */
function prepare(title: string): string {
  return normalize(title)
    .replace(/(\d{2})(?:[.,]\d)?\s*mm\b/g, '$1mm')
    .replace(/galaxy\s*watch\s*-?\s*(\d)/g, 'galaxy watch $1')
    .replace(/watch\s*-?\s*(\d)/g, 'watch $1')
    .replace(/[()[\]{}|,;:!?®™]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectModelsByCode(raw: string): { model: ModelId; size?: number; connectivity: Connectivity }[] {
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  const hits: { model: ModelId; size?: number; connectivity: Connectivity }[] = [];
  for (const spec of MODELS) {
    for (const code of spec.codes) {
      const compact = code.code.replace('-', '');
      if (upper.includes(code.code) || upper.includes(compact)) {
        hits.push({ model: spec.id, size: code.size, connectivity: code.connectivity });
      }
    }
  }
  return hits;
}

function detectModelsByName(t: string): ModelHit[] {
  const hits: ModelHit[] = [];
  const push = (model: ModelId, re: RegExp) => {
    const m = re.exec(t);
    if (m) hits.push({ model, start: m.index });
  };

  // Samsung — exige "galaxy watch" para evitar clones "Watch 8 Ultra".
  push('galaxy-watch8-classic', /\bgalaxy watch 8 classic\b/);
  if (!/\bgalaxy watch 8 classic\b/.test(t)) push('galaxy-watch8', /\bgalaxy watch 8\b(?!\s*(ultra|pro\b))/);
  push('galaxy-watch4-classic', /\bgalaxy watch 4 classic\b/);
  if (!/\bgalaxy watch 4 classic\b/.test(t)) push('galaxy-watch4', /\bgalaxy watch 4\b(?![\d.,]|\s*g\b)/);
  push('galaxy-watch-fe', /\bgalaxy watch fe\b/);

  // Xiaomi — "Xiaomi Watch 2" sem Redmi/Band/Lite.
  if (/\bxiaomi\b/.test(t) && !/\b(redmi|smart band|mi band|band \d|lite|haylou|amazfit|s\s?\d)\b/.test(t.replace(/\bwatch 2 pro\b/, ''))) {
    push('xiaomi-watch2-pro', /\b(xiaomi\s+)?(mi\s+)?watch 2 pro\b/);
    if (!/\bwatch 2 pro\b/.test(t)) push('xiaomi-watch2', /\bxiaomi\s+(mi\s+)?watch 2\b(?![\d.,])/);
  }
  return hits;
}

/** Gerações de Galaxy Watch mencionadas (para pegar listas de compatibilidade). */
function galaxyGenerationsMentioned(t: string): Set<string> {
  const gens = new Set<string>();
  for (const m of t.matchAll(/\bwatch\s+(\d{1,2})\b(?!\s*mm)/g)) gens.add(m[1]);
  for (const m of t.matchAll(/\bwatch\s+\d{1,2}((?:\s*(?:\/|e|\s)\s*\d{1,2}\b(?!mm|gb|g\b))+)/g)) {
    for (const n of m[1].match(/\d{1,2}/g) ?? []) gens.add(n);
  }
  if (/\bwatch\s+(fe)\b/.test(t)) gens.add('fe');
  if (/\bwatch\s+ultra\b/.test(t)) gens.add('ultra');
  if (/\bwatch\s+active\b/.test(t)) gens.add('active');
  return gens;
}

function detectSize(t: string, model: ModelId): number | undefined {
  const spec = getModel(model);
  if (spec.sizes.length === 0) return undefined;
  const found = new Set<number>();
  for (const m of t.matchAll(/\b(3[89]|4[0-9])(?:[.,]\d)?\s*mm\b/g)) found.add(Number(m[1]));
  const valid = [...found].filter((s) => spec.sizes.includes(s));
  if (valid.length === 1) return valid[0];
  if (spec.sizes.length === 1 && valid.length === 0 && found.size === 0) return spec.sizes[0];
  return undefined;
}

function detectConnectivity(t: string): Connectivity {
  if (LTE.test(t)) return 'lte';
  return 'bt';
}

export function detectCondition(t: string): Condition {
  if (REFURB.test(t)) return 'recondicionado';
  if (USED.test(t)) return 'usado';
  return 'novo';
}

export interface ClassifyInput {
  title: string;
  price?: number;
  conditionHint?: Condition;
}

export function classify(input: ClassifyInput): Classification {
  const t = prepare(input.title);
  const condition = input.conditionHint ?? detectCondition(t);
  const base = { condition };

  const codeHits = detectModelsByCode(input.title);
  const nameHits = detectModelsByName(t);
  const models = new Set<ModelId>([...codeHits.map((h) => h.model), ...nameHits.map((h) => h.model)]);

  if (models.size === 0) {
    if (CLONE_WORDS.test(t) && /\bwatch\s+(8|4|fe|2)\b/.test(t)) {
      return { ...base, kind: 'clone', reason: 'Relógio genérico usando o nome do modelo' };
    }
    return { ...base, kind: 'other', reason: 'Nenhum modelo rastreado no título' };
  }

  // Acessórios: começam com a palavra do acessório ou são "para"/"compatível com" o relógio.
  if (ACCESSORY_START.test(t)) return { ...base, kind: 'accessory', reason: 'Título começa com acessório' };
  if (FOR_DEVICE.test(t) && !/^(smartwatch|relogio|samsung|galaxy|xiaomi)\b/.test(t)) {
    return { ...base, kind: 'accessory', reason: 'Anúncio "para" o relógio' };
  }
  if (/\b(compativel|compatível)\b/.test(t)) {
    return { ...base, kind: 'accessory', reason: 'Item "compatível com" o relógio' };
  }

  if (BUNDLE.test(t)) return { ...base, kind: 'bundle', reason: 'Combo com outro produto' };

  // Relógio genérico citando o modelo ("Smartwatch W28 Pro Watch 8").
  if (CLONE_WORDS.test(t) && !/\bsamsung\b|\bxiaomi\b/.test(t)) {
    return { ...base, kind: 'clone', reason: 'Indícios de relógio genérico' };
  }

  // Família Samsung: várias gerações citadas = lista de compatibilidade.
  const gens = galaxyGenerationsMentioned(t);
  const samsungHits = [...models].filter((m) => m.startsWith('galaxy'));
  if (samsungHits.length > 0 && gens.size > 1) {
    return { ...base, kind: 'ambiguous', reason: `Cita várias gerações (${[...gens].join(', ')})` };
  }

  // Se sobrou mais de um modelo, a prioridade é o código do fabricante.
  let model: ModelId;
  const codeModels = new Set(codeHits.map((h) => h.model));
  if (codeModels.size === 1) {
    model = [...codeModels][0];
  } else if (models.size === 1) {
    model = [...models][0];
  } else {
    return { ...base, kind: 'ambiguous', reason: `Mais de um modelo no título (${[...models].join(', ')})` };
  }

  // Palavra de acessório no meio do título + preço baixo = acessório.
  const spec = getModel(model);
  const minPrice = condition === 'novo' ? spec.plausible.min : spec.plausible.min * 0.45;
  if (input.price !== undefined && input.price < minPrice) {
    const accessoryWord = ACCESSORY_WORDS.some((w) => t.includes(w));
    return {
      ...base,
      kind: accessoryWord ? 'accessory' : 'implausible',
      model,
      reason: accessoryWord
        ? 'Menciona acessório e o preço é de acessório'
        : `Preço abaixo do plausível para ${spec.shortName} (${minPrice.toFixed(0)})`,
    };
  }

  const code = codeHits.find((h) => h.model === model);
  const size = code?.size ?? detectSize(t, model);
  const connectivity = code?.connectivity ?? detectConnectivity(t);
  return { kind: 'device', model, size, connectivity, condition, reason: code ? 'Código do fabricante' : 'Nome do modelo' };
}
