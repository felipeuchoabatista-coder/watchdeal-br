const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  atilde: 'ã', otilde: 'õ', ccedil: 'ç', acirc: 'â', ecirc: 'ê', ocirc: 'ô',
  agrave: 'à', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  Atilde: 'Ã', Otilde: 'Õ', Ccedil: 'Ç', ordm: 'º', ordf: 'ª', deg: '°', reg: '®', trade: '™',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Minúsculas, sem acentos, sem pontuação supérflua, espaços colapsados. */
export function normalize(text: string): string {
  return decodeEntities(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[“”"'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Converte "R$ 1.282,55", "1282.55" ou 1282.55 em número. */
export function parseBRL(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? round2(value) : undefined;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\d.,]/g, '');
  if (!cleaned) return undefined;
  let num: number;
  if (cleaned.includes(',')) {
    num = Number(cleaned.replace(/\./g, '').replace(',', '.'));
  } else if (/\.\d{3}$/.test(cleaned) && !/\.\d{1,2}$/.test(cleaned)) {
    num = Number(cleaned.replace(/\./g, ''));
  } else {
    num = Number(cleaned);
  }
  return Number.isFinite(num) && num > 0 ? round2(num) : undefined;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SP_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia no fuso de São Paulo, formato YYYY-MM-DD. */
export function spDay(date: Date | string | number = new Date()): string {
  return SP_DAY.format(new Date(date));
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Hash curto e estável (FNV-1a) para montar identificadores. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round2((sorted[mid - 1] + sorted[mid]) / 2);
}
