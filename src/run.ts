import { join } from 'node:path';
import { channelsFromEnv, pendingAlerts, ALERT_TTL_MS } from './alerts/notify.ts';
import { MODELS } from './core/catalog.ts';
import { DOLLAR_SOURCE_NAMES, fetchQuote, mergeDollar, parseSgs, sgsUrl, type GetJson } from './core/dolar.ts';
import { BlockedError, fetchJson, fetchText, type Fetcher } from './core/http.ts';
import { addDays, spDay } from './core/text.ts';
import type { Coupon, DealEvent, Health, ModelHistory, ModelId, RawOffer, SourceHealth, SourceId } from './core/types.ts';
import { runCycle } from './pipeline.ts';
import { SOURCES } from './sources/index.ts';
import type { ExternalHistory, Source, SourceResult } from './sources/source.ts';
import { DataStore, loadConfig } from './store.ts';

/**
 * Uma rodada de coleta: roda as fontes que estão "na hora", classifica,
 * pontua, atualiza histórico, gera eventos e envia alertas.
 *
 * Uso: node src/run.ts [--forcar] [--sem-alertas] [--fontes=zoom,kabum]
 */

const SOURCE_TIMEOUT_MS = 150_000;
const MAX_EVENTS = 300;

interface RunOptions {
  dataDir: string;
  configPath: string;
  force: boolean;
  alerts: boolean;
  only?: SourceId[];
  fetcher: Fetcher;
  now?: Date;
  log?: (msg: string) => void;
  /** Atualizar a cotação do dólar (padrão: sim). */
  dollar?: boolean;
  /** Chave opcional da AwesomeAPI (segredo AWESOMEAPI_TOKEN): sem cache e sem limite por IP. */
  awesomeToken?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: tempo esgotado (${ms / 1000}s)`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function isDue(source: Source, lastRunAt: string | undefined, now: Date): boolean {
  if (!lastRunAt) return true;
  // 1 min de folga: o agendador do GitHub atrasa e varia.
  return now.getTime() - new Date(lastRunAt).getTime() >= (source.everyMinutes - 1) * 60_000;
}

/** O histórico diário do dólar muda uma vez por dia: baixa de novo a cada 6 h. */
const DOLLAR_DAILY_EVERY_MS = 6 * 3_600_000;

/**
 * Atualiza data/dolar.json: cotação atual e fechamentos diários. Falha aqui não
 * afeta as ofertas; o app mostra a última cotação salva, com o horário dela.
 */
async function updateDollar(store: DataStore, fetcher: Fetcher, now: Date, log: (msg: string) => void, token?: string): Promise<void> {
  const prev = await store.dollar().catch(() => null);
  const get: GetJson = (url) => fetchJson(fetcher, url, { retries: 1, timeoutMs: 10_000 });
  const today = spDay(now);
  const lastDay = prev?.daily.at(-1)?.d;
  const dailyAge = prev?.dailyUpdatedAt ? now.getTime() - new Date(prev.dailyUpdatedAt).getTime() : Infinity;
  const needDaily = !lastDay || dailyAge >= DOLLAR_DAILY_EVERY_MS;
  const [quote, daily] = await Promise.all([
    fetchQuote(get, now, token).catch((err: Error) => {
      log(`  ✗ Dólar: ${err.message}`);
      return undefined;
    }),
    needDaily
      ? get(sgsUrl(lastDay ? addDays(lastDay, -7) : addDays(today, -560), today))
          .then(parseSgs)
          .catch((err: Error) => {
            log(`  ✗ Dólar (histórico): ${err.message}`);
            return undefined;
          })
      : Promise.resolve(undefined),
  ]);
  if (!quote && !daily) return;
  await store.write('dolar.json', mergeDollar(prev, { quote, daily }, now));
  if (quote) log(`  ✓ Dólar: R$ ${quote.sell.toFixed(4)} (${DOLLAR_SOURCE_NAMES[quote.source]})`);
}

export async function runOnce(opts: RunOptions): Promise<{ health: Health; events: DealEvent[]; sent: number }> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const started = Date.now();
  const now = opts.now ?? new Date();
  const store = new DataStore(opts.dataDir);
  const config = await loadConfig(opts.configPath);
  const [previous, previousCoupons, previousEvents, previousHealth, state] = await Promise.all([
    store.snapshot(), store.coupons(), store.events(), store.health(), store.state(),
  ]);
  const histories = Object.fromEntries(
    await Promise.all(MODELS.map(async (m) => [m.id, await store.history(m.id)] as const)),
  ) as Record<ModelId, ModelHistory>;

  const due = SOURCES.filter((s) => (opts.only ? opts.only.includes(s.id) : true))
    .filter((s) => opts.force || isDue(s, state.sources[s.id]?.lastRunAt, now));
  log(`Fontes nesta rodada: ${due.map((s) => s.name).join(', ') || 'nenhuma'}`);

  // Cotação do dólar, em paralelo com as fontes.
  const dollarTask = opts.dollar === false
    ? Promise.resolve()
    : withTimeout(updateDollar(store, opts.fetcher, now, log, opts.awesomeToken), 60_000, 'Dólar')
        .catch((err: Error) => log(`  ✗ ${err.message}`));

  const rawBySource: Partial<Record<SourceId, RawOffer[]>> = {};
  const couponsBySource: Partial<Record<SourceId, Coupon[]>> = {};
  const externalHistory: ExternalHistory[] = [];
  const healthBySource = new Map<SourceId, SourceHealth>(
    (previousHealth?.sources ?? []).map((h) => [h.source, { ...h }]),
  );

  await Promise.all(due.map(async (source) => {
    const t0 = Date.now();
    const slot = (state.sources[source.id] ??= { memory: {} });
    const prev = healthBySource.get(source.id);
    try {
      const result: SourceResult = await withTimeout(
        source.collect(opts.fetcher, { now, memory: slot.memory }),
        SOURCE_TIMEOUT_MS,
        source.name,
      );
      rawBySource[source.id] = result.offers;
      if (result.coupons) couponsBySource[source.id] = result.coupons;
      externalHistory.push(...(result.history ?? []));
      slot.lastRunAt = now.toISOString();
      // Nenhum item é suspeito: layout novo ou bloqueio silencioso.
      if (result.items === 0) (result.warnings ??= []).unshift('Nenhum item retornado — o site pode ter mudado');
      healthBySource.set(source.id, {
        source: source.id,
        status: result.warnings?.length ? 'degradado' : 'ok',
        lastRunAt: now.toISOString(),
        lastOkAt: now.toISOString(),
        durationMs: Date.now() - t0,
        items: result.items,
        matched: 0,
        error: result.warnings?.length ? result.warnings.slice(0, 3).join(' | ') : undefined,
        notes: result.notes?.length ? result.notes.slice(0, 5) : undefined,
        consecutiveFailures: 0,
      });
      log(`  ✓ ${source.name}: ${result.items} itens, ${result.offers.length} ofertas${result.warnings?.length ? ` (${result.warnings.length} avisos)` : ''}`);
    } catch (err) {
      const blocked = err instanceof BlockedError;
      // Falhou: tenta de novo na próxima rodada (não atualiza lastRunAt).
      healthBySource.set(source.id, {
        source: source.id,
        status: blocked ? 'bloqueado' : 'falhou',
        lastRunAt: now.toISOString(),
        lastOkAt: prev?.lastOkAt,
        durationMs: Date.now() - t0,
        items: 0,
        matched: 0,
        error: err instanceof Error ? err.message : String(err),
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
      });
      log(`  ✗ ${source.name}: ${err instanceof Error ? err.message : err}`);
    }
  }));

  const out = runCycle({
    now,
    rawBySource,
    couponsBySource,
    externalHistory,
    previous,
    previousCoupons: previousCoupons.coupons,
    histories,
    state,
    config,
  });

  for (const [source, matched] of Object.entries(out.matchedBySource) as [SourceId, number][]) {
    const h = healthBySource.get(source);
    if (h) h.matched = matched;
  }
  // Fontes que nunca rodaram aparecem como "aguardando".
  for (const s of SOURCES) {
    if (!healthBySource.has(s.id)) healthBySource.set(s.id, { source: s.id, status: 'aguardando', items: 0, matched: 0, consecutiveFailures: 0 });
  }

  // Alertas: na primeira execução só registra (evita enxurrada de notificações).
  const firstRun = !previous;
  const pending = pendingAlerts(out.events, state.alertsSent, now);
  let sent = 0;
  const channels = opts.alerts && !firstRun ? channelsFromEnv(config) : [];
  const appUrl = process.env.WATCHDEAL_APP_URL;
  for (const event of pending.slice(0, 12)) {
    let delivered = channels.length === 0;
    for (const ch of channels) {
      try {
        await ch.send(event, appUrl);
        delivered = true;
      } catch (err) {
        log(`  ! alerta via ${ch.name} falhou: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (delivered) {
      state.alertsSent[event.id] = now.toISOString();
      if (channels.length) sent++;
    }
  }
  for (const [key, when] of Object.entries(state.alertsSent)) {
    if (now.getTime() - new Date(when).getTime() > ALERT_TTL_MS * 2) delete state.alertsSent[key];
  }

  const knownEventIds = new Set(previousEvents.events.map((e) => e.id));
  const newEvents = out.events.filter((e) => !knownEventIds.has(e.id));
  const events = [...newEvents, ...previousEvents.events].slice(0, MAX_EVENTS);

  const health: Health = {
    generatedAt: now.toISOString(),
    cycleMs: Date.now() - started,
    sources: SOURCES.map((s) => healthBySource.get(s.id)!),
  };

  await Promise.all([
    store.write('ofertas.json', out.snapshot),
    store.write('cupons.json', { generatedAt: now.toISOString(), coupons: out.coupons }),
    store.write('eventos.json', { generatedAt: now.toISOString(), events }),
    store.write('saude.json', health),
    store.write('estado.json', state),
    ...Object.values(out.histories).map((h) => store.write(`historico/${h.model}.json`, h)),
    dollarTask,
  ]);

  log(`Pronto: ${out.snapshot.offers.length} ofertas, ${out.coupons.length} cupons, ${newEvents.length} eventos novos, ${sent} alertas enviados (${((Date.now() - started) / 1000).toFixed(1)}s).`);
  return { health, events: newEvents, sent };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--fontes='))?.split('=')[1]?.split(',') as SourceId[] | undefined;
  runOnce({
    dataDir: process.env.WATCHDEAL_DATA_DIR ?? join(process.cwd(), 'data'),
    configPath: join(process.cwd(), 'config', 'alertas.json'),
    force: args.includes('--forcar'),
    alerts: !args.includes('--sem-alertas'),
    only,
    fetcher: fetchText,
    awesomeToken: process.env.AWESOMEAPI_TOKEN?.trim() || undefined,
  })
    .then(({ health }) => {
      // Falha a execução só se TODAS as fontes que rodaram deram erro e ao menos uma
      // falhou de verdade. Bloqueio é esperado (o Pelando sempre bloqueia o GitHub) e
      // aparece na aba Fontes; não deve gerar e-mail de falha a cada rodada.
      const ran = health.sources.filter((s) => s.lastRunAt === health.generatedAt);
      const allDown = ran.length > 0 && ran.every((s) => s.status === 'falhou' || s.status === 'bloqueado');
      if (allDown && ran.some((s) => s.status === 'falhou')) process.exitCode = 1;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
