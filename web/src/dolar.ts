import { useEffect, useState } from 'react';
import { AWESOME_URL, fetchQuote, type DollarFile, type DollarQuote } from '../../src/core/dolar.ts';

/** Sem chave, a AwesomeAPI atualiza a cada 1 min: buscar mais vezes não adianta. */
const LIVE_MS = 60_000;
/** Nenhuma fonte respondeu (sem internet, limite de uso): tenta de novo em 5 min. */
const RETRY_MS = 5 * 60_000;
/** Cotação ao vivo mais velha que isso (falhas seguidas) dá lugar à da coleta. */
const LIVE_MAX_AGE_MS = 10 * 60_000;

/** A AwesomeAPI recusou por limite de uso (HTTP 429): pula ela por 15 min. */
const AWESOME_PAUSE_MS = 15 * 60_000;
let awesomePausedUntil = 0;

async function getJson(url: string): Promise<unknown> {
  const awesome = url.startsWith(AWESOME_URL);
  // Enquanto a AwesomeAPI estiver no limite, nem tenta: a Coinbase responde no lugar,
  // e o limite tem tempo de se renovar.
  if (awesome && Date.now() < awesomePausedUntil) throw new Error('limite de uso; tentando de novo mais tarde');
  const res = await fetch(url, { cache: 'no-store' });
  if (awesome && res.status === 429) awesomePausedUntil = Date.now() + AWESOME_PAUSE_MS;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const rate4 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format;
export const rate2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
export const pct2 = (value: number) => `${pctFmt.format(value)}%`;

/**
 * Cotação do dólar ao vivo. Enquanto o app está na tela, ele mesmo consulta as
 * fontes a cada minuto. Sem conseguir (ou com o app em segundo plano), vale a
 * cotação salva pela coleta, que roda a cada 5 min.
 */
export function useLiveDollar(file: DollarFile | null): { quote?: DollarQuote; live: boolean } {
  const [live, setLive] = useState<DollarQuote | null>(null);

  useEffect(() => {
    let alive = true;
    let busy = false;
    let timer: number | undefined;
    let fetchedAt = 0;
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void tick(), ms);
    };
    const tick = async () => {
      if (busy) return;
      // Em segundo plano não consulta; volta a consultar quando o app reaparece.
      if (document.visibilityState !== 'visible') return schedule(LIVE_MS);
      busy = true;
      let next = LIVE_MS;
      try {
        const quote = await fetchQuote(getJson);
        fetchedAt = Date.now();
        if (alive) setLive(quote);
      } catch {
        next = RETRY_MS;
        if (alive && Date.now() - fetchedAt > LIVE_MAX_AGE_MS) setLive(null);
      } finally {
        busy = false;
      }
      if (alive) schedule(next);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return live ? { quote: live, live: true } : { quote: file?.current, live: false };
}
