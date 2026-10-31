import { addDays, median, round2 } from './text.ts';
import type { HistoryPoint } from './types.ts';

export const HISTORY_MAX_DAYS = 400;

/** Insere um ponto mantendo o menor preço de cada dia; devolve a série ordenada. */
export function mergePoint(series: HistoryPoint[], point: HistoryPoint): HistoryPoint[] {
  const idx = series.findIndex((p) => p.d === point.d);
  if (idx === -1) {
    return [...series, point].sort((a, b) => a.d.localeCompare(b.d));
  }
  const current = series[idx];
  // Coleta própria vence empate; preço menor sempre vence.
  if (point.p < current.p || (point.p === current.p && point.o === 'coleta' && current.o !== 'coleta')) {
    const next = [...series];
    next[idx] = point;
    return next;
  }
  return series;
}

export function prune(series: HistoryPoint[], today: string): HistoryPoint[] {
  const oldest = addDays(today, -HISTORY_MAX_DAYS);
  return series.filter((p) => p.d >= oldest);
}

export interface SeriesStats {
  min90?: number;
  median30?: number;
  allTimeLow?: { price: number; date: string; store: string };
  trend7d?: number;
  days: number;
}

/**
 * Estatísticas de referência para pontuar uma oferta.
 * min90 ignora o dia de hoje para que a oferta atual possa ser "novo mínimo".
 */
export function seriesStats(series: HistoryPoint[], today: string): SeriesStats {
  const before = series.filter((p) => p.d < today);
  const last90 = before.filter((p) => p.d >= addDays(today, -90));
  const last30 = series.filter((p) => p.d >= addDays(today, -30));

  let atl: HistoryPoint | undefined;
  for (const p of before) if (!atl || p.p < atl.p) atl = p;

  const todayPoint = series.find((p) => p.d === today);
  const weekAgo = [...series].reverse().find((p) => p.d <= addDays(today, -7));
  const trend7d = todayPoint && weekAgo ? round2((todayPoint.p - weekAgo.p) / weekAgo.p * 100) / 100 : undefined;

  return {
    min90: last90.length ? Math.min(...last90.map((p) => p.p)) : undefined,
    median30: last30.length >= 3 ? median(last30.map((p) => p.p)) : undefined,
    allTimeLow: atl ? { price: atl.p, date: atl.d, store: atl.s } : undefined,
    trend7d,
    days: series.length,
  };
}
