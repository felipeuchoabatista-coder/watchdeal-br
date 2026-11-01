import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { BlockedError, type Fetcher } from '../src/core/http.ts';
import type { Health, Snapshot } from '../src/core/types.ts';
import { runOnce } from '../src/run.ts';
import { pendingAlerts } from '../src/alerts/notify.ts';
import type { CouponsFile, EventsFile } from '../src/store.ts';

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** Simula a internet com as amostras reais; `tweak` permite alterar respostas. */
function fakeFetcher(tweak: { kabumPriceFactor?: number; blockAmazon?: boolean } = {}): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    if (url.includes('zoom.com.br/smartwatch/') && !url.includes('/smartwatch/samsung')) return fx('zoom-produto.html');
    if (url.includes('zoom.com.br')) return fx('zoom-busca.html');
    if (url.includes('shop.samsung.com')) return url.includes('_from=0') && url.includes('ft=galaxy%20watch&') ? fx('samsung.json') : '[]';
    if (url.includes('grupokabum')) {
      const data = JSON.parse(fx('kabum.json'));
      if (tweak.kabumPriceFactor) {
        for (const it of data.data) {
          it.attributes.price = Math.round(it.attributes.price * tweak.kabumPriceFactor * 100) / 100;
          it.attributes.price_with_discount = Math.round(it.attributes.price_with_discount * tweak.kabumPriceFactor * 100) / 100;
        }
      }
      return JSON.stringify(data);
    }
    if (url.includes('amazon.com.br')) {
      if (tweak.blockAmazon) throw new BlockedError('www.amazon.com.br exibiu página de verificação');
      return fx('amazon.html');
    }
    if (url.includes('pelando.com.br')) return fx('pelando.html');
    if (url.includes('promobit') && url.includes('/coupons')) return fx('promobit-cupons.json');
    if (url.includes('promobit') && url.includes('FINISHED')) return JSON.stringify({ offers: [] });
    if (url.includes('promobit')) return fx('promobit-ofertas.json');
    throw new Error(`URL inesperada no teste: ${url}`);
  }) as Fetcher & { calls: string[] };
  fetcher.calls = calls;
  return fetcher;
}

function readJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(join(dir, name), 'utf8')) as T;
}

test('ciclo completo: coleta, classifica, pontua, guarda histórico e respeita intervalos', async () => {
  // Temporário dentro do projeto (.tmp/), nunca na pasta temporária do sistema.
  const tmpRoot = join(import.meta.dirname, '..', '.tmp');
  mkdirSync(tmpRoot, { recursive: true });
  const dir = mkdtempSync(join(tmpRoot, 'watchdeal-'));
  const base = { dataDir: dir, configPath: join(dir, 'nao-existe.json'), force: false, alerts: false, log: () => {} };
  try {
    // 1ª rodada: todas as fontes.
    const t0 = new Date('2026-10-31T15:00:00Z');
    const first = await runOnce({ ...base, fetcher: fakeFetcher(), now: t0 });
    assert.ok(first.health.sources.every((s) => s.status === 'ok' || s.status === 'degradado'), JSON.stringify(first.health.sources));

    const snap = readJson<Snapshot>(dir, 'ofertas.json');
    assert.ok(snap.offers.length >= 10, `ofertas: ${snap.offers.length}`);
    assert.equal(snap.summary.length, 7);
    for (const o of snap.offers) {
      assert.doesNotMatch(o.title, /^(pulseira|pel[ií]cula|capa|carregador)/i, o.title);
      assert.ok(o.score.value >= 0 && o.score.value <= 100);
      assert.ok(o.variantKey.startsWith(o.model));
    }
    const ids = snap.offers.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, 'ids únicos');
    const sorted = [...snap.offers].sort((a, b) => b.score.value - a.score.value);
    assert.deepEqual(snap.offers.map((o) => o.id), sorted.map((o) => o.id), 'ordenado pelo índice');

    const w8 = readJson<{ variants: Record<string, { d: string; p: number }[]> }>(dir, 'historico/galaxy-watch8.json');
    assert.ok((w8.variants['40mm-bt'] ?? []).length >= 30, 'histórico do Zoom importado');
    assert.ok(w8.variants['40mm-bt'].some((p) => p.d === '2026-10-31'), 'ponto de hoje registrado');

    const coupons = readJson<CouponsFile>(dir, 'cupons.json');
    assert.ok(coupons.coupons.length > 0);

    // 2ª rodada, 20 min depois: Amazon (30 min) não está na hora e suas ofertas são mantidas.
    const fetch2 = fakeFetcher();
    await runOnce({ ...base, fetcher: fetch2, now: new Date(t0.getTime() + 20 * 60_000) });
    assert.ok(!fetch2.calls.some((u) => u.includes('amazon.com.br')), 'Amazon não consultada antes da hora');
    assert.ok(fetch2.calls.some((u) => u.includes('promobit.com.br')), 'Promobit (5 min) consultado');
    assert.ok(!fetch2.calls.some((u) => u.includes('pelando.com.br')), 'Pelando (30 min) não consultado antes da hora');
    const snap2 = readJson<Snapshot>(dir, 'ofertas.json');
    const amazonOffers = snap2.offers.filter((o) => o.source === 'amazon');
    assert.ok(amazonOffers.length > 0, 'ofertas da Amazon mantidas');
    assert.ok(amazonOffers.every((o) => o.lastSeen === t0.toISOString()));

    // 3ª rodada: KaBuM baixa 25% e Amazon passa a bloquear.
    const t3 = new Date(t0.getTime() + 40 * 60_000);
    const third = await runOnce({ ...base, fetcher: fakeFetcher({ kabumPriceFactor: 0.75, blockAmazon: true }), now: t3 });
    const health = readJson<Health>(dir, 'saude.json');
    const amazonHealth = health.sources.find((s) => s.source === 'amazon')!;
    assert.equal(amazonHealth.status, 'bloqueado');
    assert.equal(amazonHealth.consecutiveFailures, 1);
    assert.equal(health.sources.find((s) => s.source === 'kabum')!.status, 'ok');

    const types = new Set(third.events.map((e) => e.type));
    assert.ok(types.has('queda-preco'), `eventos: ${[...types].join(', ')}`);
    assert.ok(types.has('novo-minimo') || types.has('imperdivel'));
    const events = readJson<EventsFile>(dir, 'eventos.json');
    assert.ok(events.events.length >= third.events.length);
    assert.equal(new Set(events.events.map((e) => e.id)).size, events.events.length, 'eventos sem duplicata');

    // Os mesmos eventos não geram alerta de novo.
    const state = readJson<{ alertsSent: Record<string, string> }>(dir, 'estado.json');
    assert.equal(pendingAlerts(third.events, state.alertsSent, new Date(t3.getTime() + 60_000)).length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
