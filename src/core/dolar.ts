/**
 * Cotação do dólar comercial (US$ 1 em reais), usada pela coleta e pelo app.
 *
 * Fontes, na ordem em que são tentadas:
 *  1. AwesomeAPI: dólar comercial em tempo real (compra, venda, máxima, mínima e
 *     variação do dia). Sem chave, a resposta fica em cache por 1 minuto e há
 *     limite de requisições por IP.
 *  2. Coinbase: taxa de mercado em tempo real (um valor só). Entra quando a
 *     AwesomeAPI recusa ou está fora do ar.
 *  3. Banco Central (PTAX): oficial, mas só alguns boletins por dia (10h às 13h).
 *
 * O histórico diário é o fechamento PTAX de venda do Banco Central (série 1 do SGS).
 * Todas as fontes aceitam chamadas direto do navegador (CORS).
 */

import { spDay } from './text.ts';

export type DollarSource = 'awesomeapi' | 'coinbase' | 'bcb';

export interface DollarQuote {
  /** Venda, em R$ por US$ 1. Na Coinbase, a taxa de mercado. */
  sell: number;
  buy?: number;
  high?: number;
  low?: number;
  /** Variação no dia, em %, quando a fonte informa. */
  changePct?: number;
  /** Momento da cotação (ISO). */
  at: string;
  source: DollarSource;
}

export interface DollarPoint {
  /** Dia (YYYY-MM-DD). */
  d: string;
  /** Fechamento PTAX de venda. */
  v: number;
}

export interface DollarFile {
  generatedAt: string;
  current?: DollarQuote;
  /** Fechamentos diários (dias úteis), do mais antigo ao mais novo. */
  daily: DollarPoint[];
  /** Quando o histórico diário foi baixado do Banco Central pela última vez. */
  dailyUpdatedAt?: string;
}

export const DOLLAR_SOURCE_NAMES: Record<DollarSource, string> = {
  awesomeapi: 'AwesomeAPI',
  coinbase: 'Coinbase',
  bcb: 'Banco Central (PTAX)',
};

export const AWESOME_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
export const COINBASE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';

/** Boletins PTAX de um dia (YYYY-MM-DD). */
export function ptaxUrl(day: string): string {
  const [y, m, d] = day.split('-');
  return `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='USD'&@dataCotacao='${m}-${d}-${y}'&$format=json`;
}

/** Fechamentos diários do dólar (SGS 1) entre dois dias (YYYY-MM-DD). */
export function sgsUrl(from: string, to: string): string {
  const br = (day: string) => day.split('-').reverse().join('/');
  return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=${br(from)}&dataFinal=${br(to)}`;
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Descarta valores absurdos (resposta corrompida, moeda trocada). */
function rate(value: unknown): number | undefined {
  const n = toNumber(value);
  return n !== undefined && n > 1 && n < 50 ? n : undefined;
}

export function parseAwesome(json: unknown, now: Date): DollarQuote {
  const q = (json as { USDBRL?: Record<string, unknown> } | null)?.USDBRL;
  const sell = rate(q?.ask);
  if (!q || sell === undefined) throw new Error('resposta sem cotação');
  const ts = toNumber(q.timestamp);
  return {
    sell,
    buy: rate(q.bid),
    high: rate(q.high),
    low: rate(q.low),
    changePct: toNumber(q.pctChange),
    at: ts && ts > 0 ? new Date(ts * 1000).toISOString() : now.toISOString(),
    source: 'awesomeapi',
  };
}

export function parseCoinbase(json: unknown, now: Date): DollarQuote {
  const data = (json as { data?: { currency?: string; rates?: Record<string, unknown> } } | null)?.data;
  const sell = data?.currency === 'USD' ? rate(data.rates?.BRL) : undefined;
  if (sell === undefined) throw new Error('resposta sem cotação');
  return { sell, at: now.toISOString(), source: 'coinbase' };
}

/** Último boletim PTAX do dia. O horário do Banco Central é o de Brasília (UTC−3). */
export function parsePtax(json: unknown): DollarQuote {
  const list = (json as { value?: Record<string, unknown>[] } | null)?.value ?? [];
  const last = list[list.length - 1];
  const sell = rate(last?.cotacaoVenda);
  const when = typeof last?.dataHoraCotacao === 'string' ? last.dataHoraCotacao : '';
  const at = new Date(`${when.slice(0, 19).replace(' ', 'T')}-03:00`);
  if (sell === undefined || Number.isNaN(at.getTime())) throw new Error('sem boletim hoje');
  return { sell, buy: rate(last?.cotacaoCompra), at: at.toISOString(), source: 'bcb' };
}

/** Série do SGS: [{ data: "dd/mm/aaaa", valor: "5.4778" }]. */
export function parseSgs(json: unknown): DollarPoint[] {
  if (!Array.isArray(json)) throw new Error('resposta inesperada do Banco Central');
  const points: DollarPoint[] = [];
  for (const row of json as { data?: unknown; valor?: unknown }[]) {
    const m = typeof row?.data === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.data) : null;
    const v = rate(row?.valor);
    if (m && v !== undefined) points.push({ d: `${m[3]}-${m[2]}-${m[1]}`, v });
  }
  return points;
}

export type GetJson = (url: string) => Promise<unknown>;

/** Tenta as fontes em ordem e devolve a primeira cotação válida. */
export async function fetchQuote(get: GetJson, now = new Date(), awesomeToken?: string): Promise<DollarQuote> {
  const attempts: [string, () => Promise<DollarQuote>][] = [
    ['AwesomeAPI', async () => parseAwesome(await get(awesomeToken ? `${AWESOME_URL}?token=${encodeURIComponent(awesomeToken)}` : AWESOME_URL), now)],
    ['Coinbase', async () => parseCoinbase(await get(COINBASE_URL), now)],
    ['Banco Central', async () => parsePtax(await get(ptaxUrl(spDay(now))))],
  ];
  const errors: string[] = [];
  for (const [name, attempt] of attempts) {
    try {
      return await attempt();
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`cotação do dólar indisponível (${errors.join('; ')})`);
}

const MAX_DAILY = 400;

/** Junta a cotação nova e os fechamentos baixados ao arquivo anterior. */
export function mergeDollar(
  prev: DollarFile | null,
  update: { quote?: DollarQuote; daily?: DollarPoint[] },
  now: Date,
): DollarFile {
  const byDay = new Map((prev?.daily ?? []).map((p) => [p.d, p.v]));
  for (const p of update.daily ?? []) byDay.set(p.d, p.v);
  const daily = [...byDay]
    .map(([d, v]) => ({ d, v }))
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(-MAX_DAILY);
  return {
    generatedAt: now.toISOString(),
    current: update.quote ?? prev?.current,
    daily,
    dailyUpdatedAt: update.daily ? now.toISOString() : prev?.dailyUpdatedAt,
  };
}

/** Fechamento do último dia útil antes de `day`. */
export function previousClose(daily: DollarPoint[], day: string): number | undefined {
  for (let i = daily.length - 1; i >= 0; i--) if (daily[i].d < day) return daily[i].v;
  return undefined;
}

/** Dólar de um dia: o fechamento daquele dia ou do último dia útil antes dele. */
export function dollarOn(daily: DollarPoint[], day: string): number | undefined {
  for (let i = daily.length - 1; i >= 0; i--) if (daily[i].d <= day) return daily[i].v;
  return undefined;
}

/** Variação no dia, em %: a da fonte ou, sem ela, contra o fechamento anterior. */
export function dayChangePct(quote: DollarQuote, daily: DollarPoint[]): number | undefined {
  if (quote.changePct !== undefined) return quote.changePct;
  const prev = previousClose(daily, spDay(quote.at));
  return prev ? (quote.sell / prev - 1) * 100 : undefined;
}
