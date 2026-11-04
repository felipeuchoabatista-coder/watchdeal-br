import { useCallback, useEffect, useState } from 'react';
import type { DollarFile } from '../../src/core/dolar.ts';
import type { Coupon, DealEvent, Health, ModelHistory, ModelId, Snapshot } from '../../src/core/types.ts';

export interface AppData {
  snapshot: Snapshot;
  coupons: Coupon[];
  events: DealEvent[];
  health: Health | null;
  /** Cotação do dólar salva pela coleta (o app também busca ao vivo). */
  dollar: DollarFile | null;
}

/**
 * De onde vêm os dados. No GitHub, direto do branch "data"
 * (raw.githubusercontent.com), que a coleta atualiza a cada 5 min sem
 * precisar republicar o app. Em desenvolvimento, a pasta data/ local.
 */
const BASE = (import.meta.env.VITE_DATA_URL || 'data/').replace(/\/?$/, '/');

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}${name}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snapshot, coupons, events, health, dollar] = await Promise.all([
        getJson<Snapshot>('ofertas.json'),
        getJson<{ coupons: Coupon[] }>('cupons.json').catch(() => ({ coupons: [] })),
        getJson<{ events: DealEvent[] }>('eventos.json').catch(() => ({ events: [] })),
        getJson<Health>('saude.json').catch(() => null),
        getJson<DollarFile>('dolar.json').catch(() => null),
      ]);
      setData({ snapshot, coupons: coupons.coupons, events: events.events, health, dollar });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Atualiza ao voltar para o app e a cada 5 minutos com ele aberto.
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void load(), 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [load]);

  return { data, error, loading, reload: load };
}

const historyCache = new Map<string, Promise<ModelHistory>>();

/** Histórico de um modelo; `version` (data do snapshot) invalida o cache. */
export function useHistory(model: ModelId, version: string | undefined) {
  const [history, setHistory] = useState<ModelHistory | null>(null);
  useEffect(() => {
    let alive = true;
    const key = `${model}@${version ?? ''}`;
    if (!historyCache.has(key)) historyCache.set(key, getJson<ModelHistory>(`historico/${model}.json`));
    historyCache.get(key)!.then((h) => alive && setHistory(h)).catch(() => alive && setHistory(null));
    return () => {
      alive = false;
    };
  }, [model, version]);
  return history;
}

// ---------- formatação ----------

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlShort = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const brl = (n: number) => brlFmt.format(n);
export const brl0 = (n: number) => brlShort.format(n);

export function pct(fraction: number, signed = true): string {
  const v = Math.round(fraction * 100);
  return `${signed && v > 0 ? '+' : ''}${v}%`;
}

export function ago(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export function dateBR(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export function untilText(iso: string, now = Date.now()): string | null {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `termina em ${h}h${String(m).padStart(2, '0')}` : `termina em ${m} min`;
}

export const SOURCE_NAMES: Record<string, string> = {
  zoom: 'Zoom',
  samsung: 'Samsung',
  kabum: 'KaBuM!',
  amazon: 'Amazon',
  pelando: 'Pelando',
  promobit: 'Promobit',
};

/** Repositório no GitHub (definido no build pelo GitHub Actions). */
export const REPO_URL: string | undefined = import.meta.env.VITE_REPO_URL || undefined;
