import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DollarFile } from './core/dolar.ts';
import type {
  AlertConfig, Coupon, DealEvent, Health, ModelHistory, ModelId, Snapshot, SourceId,
} from './core/types.ts';

/** Estado interno do coletor (não é lido pelo app). */
export interface CollectorState {
  sources: Partial<Record<SourceId, { lastRunAt?: string; memory: Record<string, unknown> }>>;
  /** Última vez em que cada oferta foi vista e o preço daquele momento. */
  offersSeen: Record<string, { firstSeen: string; lastSeen: string; price: number }>;
  /** Alertas já enviados (chave -> quando), para não repetir. */
  alertsSent: Record<string, string>;
}

export interface CouponsFile {
  generatedAt: string;
  coupons: Coupon[];
}

export interface EventsFile {
  generatedAt: string;
  events: DealEvent[];
}

export const DEFAULT_CONFIG: AlertConfig = {
  alvos: {},
  alertarNovoMinimo: true,
  indiceMinimo: 85,
  incluirUsados: false,
  incluirVariantesOcultas: false,
  canais: { telegram: true, ntfy: true },
};

export class DataStore {
  readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  private path(name: string): string {
    return join(this.dir, name);
  }

  async read<T>(name: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(this.path(name), 'utf8')) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
      throw new Error(`Arquivo de dados corrompido: ${name} (${(err as Error).message})`);
    }
  }

  /** Escrita atômica: grava num temporário e renomeia. */
  async write(name: string, data: unknown): Promise<void> {
    const target = this.path(name);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 1)}\n`, 'utf8');
    await rename(tmp, target);
  }

  snapshot = () => this.read<Snapshot | null>('ofertas.json', null);
  coupons = () => this.read<CouponsFile>('cupons.json', { generatedAt: '', coupons: [] });
  events = () => this.read<EventsFile>('eventos.json', { generatedAt: '', events: [] });
  health = () => this.read<Health | null>('saude.json', null);
  dollar = () => this.read<DollarFile | null>('dolar.json', null);
  state = () => this.read<CollectorState>('estado.json', { sources: {}, offersSeen: {}, alertsSent: {} });
  history = (model: ModelId) =>
    this.read<ModelHistory>(`historico/${model}.json`, { model, updatedAt: '', variants: {} });
}

export async function loadConfig(path: string): Promise<AlertConfig> {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<AlertConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      alvos: { ...DEFAULT_CONFIG.alvos, ...raw.alvos },
      canais: { ...DEFAULT_CONFIG.canais, ...raw.canais },
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG;
    throw new Error(`config/alertas.json inválido: ${(err as Error).message}`);
  }
}
