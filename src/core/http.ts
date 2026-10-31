/**
 * Cliente HTTP educado: identifica-se como navegador comum, espaça requisições
 * ao mesmo site e NÃO tenta contornar bloqueios — 403/429/captcha viram
 * BlockedError e a fonte fica marcada como "bloqueada" até a próxima rodada.
 */

export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedError';
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const MIN_GAP_MS = Number(process.env.WATCHDEAL_MIN_GAP_MS ?? 1200);
const lastHit = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function politeWait(host: string): Promise<void> {
  const now = Date.now();
  const next = Math.max(now, (lastHit.get(host) ?? 0) + MIN_GAP_MS);
  lastHit.set(host, next);
  if (next > now) await sleep(next - now);
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  /** Texto que, se presente na resposta, indica página de bloqueio/captcha. */
  blockMarkers?: string[];
}

export type Fetcher = (url: string, options?: FetchOptions) => Promise<string>;

export const fetchText: Fetcher = async (url, options = {}) => {
  const { timeoutMs = 20_000, retries = 2, blockMarkers = [] } = options;
  const host = new URL(url).host;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeWait(host);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.6',
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          ...options.headers,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 403 || res.status === 429) {
        throw new BlockedError(`${host} respondeu ${res.status}`);
      }
      if (!res.ok) throw new HttpError(res.status, `${host} respondeu ${res.status}`);
      const body = await res.text();
      const marker = blockMarkers.find((m) => body.includes(m));
      if (marker) throw new BlockedError(`${host} exibiu página de verificação`);
      return body;
    } catch (err) {
      lastError = err;
      if (err instanceof BlockedError) throw err;
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) throw err;
      if (attempt < retries) await sleep(1500 * 2 ** attempt + Math.random() * 500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

export async function fetchJson<T>(fetcher: Fetcher, url: string, options?: FetchOptions): Promise<T> {
  const text = await fetcher(url, { ...options, headers: { Accept: 'application/json', ...options?.headers } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta não é JSON válido (${new URL(url).host})`);
  }
}

/** Extrai o JSON do <script id="__NEXT_DATA__"> de páginas Next.js. */
export function extractNextData<T = unknown>(html: string): T {
  const m = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('Página sem __NEXT_DATA__ (layout mudou?)');
  return JSON.parse(m[1]) as T;
}
