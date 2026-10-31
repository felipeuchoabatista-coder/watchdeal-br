import { BlockedError, type Fetcher } from '../core/http.ts';
import type { Condition, Coupon, HistoryPoint, RawOffer, SourceId } from '../core/types.ts';

/** Histórico externo (Zoom, ofertas expiradas das comunidades) ainda sem modelo identificado. */
export interface ExternalHistory {
  title: string;
  conditionHint?: Condition;
  points: HistoryPoint[];
}

export interface SourceResult {
  offers: RawOffer[];
  coupons?: Coupon[];
  history?: ExternalHistory[];
  /** Itens brutos examinados (inclui acessórios, outros modelos etc.). */
  items: number;
  /** Falhas parciais (deixam a fonte "degradada"). */
  warnings?: string[];
  /** Observações informativas, sem prejuízo à coleta. */
  notes?: string[];
}

export interface SourceContext {
  now: Date;
  /** Memória da fonte entre execuções (persistida em estado.json). */
  memory: Record<string, unknown>;
}

export interface Source {
  id: SourceId;
  name: string;
  site: string;
  /** Intervalo mínimo entre coletas, em minutos. */
  everyMinutes: number;
  collect(fetcher: Fetcher, ctx: SourceContext): Promise<SourceResult>;
}

/** Busca vários endereços tolerando falhas parciais; só lança erro se TODOS falharem. */
export async function fetchAllTolerant<T>(
  tasks: { label: string; run: () => Promise<T> }[],
): Promise<{ results: T[]; warnings: string[] }> {
  const results: T[] = [];
  const warnings: string[] = [];
  const errors: unknown[] = [];
  for (const task of tasks) {
    try {
      results.push(await task.run());
    } catch (err) {
      errors.push(err);
      warnings.push(`${task.label}: ${err instanceof Error ? err.message : String(err)}`);
      // Bloqueado: para de insistir no mesmo site nesta rodada.
      if (err instanceof BlockedError) break;
    }
  }
  if (tasks.length > 0 && results.length === 0) {
    const first = errors[0];
    throw first instanceof Error ? first : new Error(String(first));
  }
  return { results, warnings };
}

export function canonicalStore(name: string | undefined | null): string {
  const n = (name ?? '').trim();
  const lower = n.toLowerCase();
  if (!n) return 'Loja desconhecida';
  if (lower.startsWith('amazon')) return 'Amazon';
  if (lower === 'magalu' || lower.startsWith('magazine luiza') || lower === 'parceiro magalu') return 'Magazine Luiza';
  if (lower.startsWith('kabum')) return 'KaBuM!';
  if (lower.startsWith('samsung')) return 'Samsung';
  if (lower.startsWith('mercado livre') || lower === 'mercadolivre') return 'Mercado Livre';
  if (lower.startsWith('casas bahia')) return 'Casas Bahia';
  if (lower.startsWith('shopee')) return 'Shopee';
  if (lower.startsWith('aliexpress')) return 'AliExpress';
  if (lower.startsWith('americanas')) return 'Americanas';
  if (lower.startsWith('carrefour')) return 'Carrefour';
  if (lower.startsWith('fast shop') || lower === 'fastshop') return 'Fast Shop';
  if (lower.startsWith('xiaomi') || lower.startsWith('mi store')) return 'Xiaomi';
  return n;
}
