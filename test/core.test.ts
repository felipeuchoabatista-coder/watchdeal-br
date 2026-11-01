import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couponFromField, couponScope, extractCouponCode, parseCouponDiscount } from '../src/core/coupons.ts';
import { mergePoint, seriesStats } from '../src/core/history.ts';
import { labelFor, scoreOffer } from '../src/core/scoring.ts';
import { addDays, decodeEntities, median, parseBRL, spDay } from '../src/core/text.ts';
import { variantLabel, variantOf } from '../src/core/catalog.ts';
import type { HistoryPoint } from '../src/core/types.ts';

test('parseBRL entende os formatos brasileiros', () => {
  assert.equal(parseBRL('R$ 1.282,55'), 1282.55);
  assert.equal(parseBRL('R$1.299'), 1299);
  assert.equal(parseBRL('1282.55'), 1282.55);
  assert.equal(parseBRL(999), 999);
  assert.equal(parseBRL('grátis'), undefined);
  assert.equal(parseBRL(0), undefined);
});

test('decodeEntities e datas no fuso de São Paulo', () => {
  assert.equal(decodeEntities('Tela 1.47&quot; &amp; Rel&#243;gio'), 'Tela 1.47" & Relógio');
  assert.equal(spDay('2026-11-01T02:30:00Z'), '2026-10-31', '23h30 em SP ainda é dia 31');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('extrai códigos de cupom sem confundir com palavras comuns', () => {
  assert.equal(extractCouponCode('Use o cupom RELOGIO100 no app'), 'RELOGIO100');
  assert.equal(extractCouponCode('Cupom: LIVESHOP'), 'LIVESHOP');
  assert.equal(extractCouponCode('código ELUX10 válido hoje'), 'ELUX10');
  assert.equal(extractCouponCode('Cupom R$120 Off'), undefined);
  assert.equal(extractCouponCode('Galaxy Watch8 BT 40mm PIX'), undefined);
  assert.equal(extractCouponCode('use o cupom exclusivo do app'), undefined);
  assert.deepEqual(parseCouponDiscount('10% OFF'), { percent: 10 });
  assert.deepEqual(parseCouponDiscount('R$ 120 OFF'), { value: 120 });
  assert.deepEqual(couponFromField('RELOGIO100'), { code: 'RELOGIO100' });
  assert.equal(couponFromField('Cupom R$120 Off')?.value, 120);
  assert.equal(couponFromField(null), undefined);
});

test('relevância dos cupons de loja', () => {
  assert.equal(couponScope('10% OFF em smartwatches', 'Amazon', false), 'smartwatch');
  assert.equal(couponScope('5% OFF em todo o site', 'KaBuM!', false), 'loja');
  assert.equal(couponScope('20% OFF em cadeiras gamer', 'KaBuM!', false), undefined);
  assert.equal(couponScope('A chance de economizar 10%', 'Magazine Luiza', false, 'MODAFULL'), undefined);
  assert.equal(couponScope('Tech Week até 33%', 'Samsung', false), 'loja');
  assert.equal(couponScope('qualquer coisa', 'Shopee', true), 'modelo');
});

test('importado perde pontos e o bônus de loja confiável, com o motivo explicado', () => {
  const ref = { median30: 1500, min90: 1400, days: 40 };
  const nacional = scoreOffer({ price: 1450, store: 'Amazon' }, ref);
  const importado = scoreOffer({ price: 1450, store: 'Amazon', imported: true }, ref);
  assert.equal(nacional.value - importado.value, 8, '−5 de importado e sem o +3 de loja confiável');
  assert.ok(importado.reasons.includes('Importado: garantia e taxas podem ser diferentes'));
  assert.ok(!nacional.reasons.some((r) => r.startsWith('Importado')));
});

test('histórico guarda o menor preço do dia e calcula referências', () => {
  let s: HistoryPoint[] = [];
  s = mergePoint(s, { d: '2026-10-30', p: 1300, s: 'A', o: 'zoom' });
  s = mergePoint(s, { d: '2026-10-30', p: 1250, s: 'B', o: 'coleta' });
  s = mergePoint(s, { d: '2026-10-30', p: 1280, s: 'C', o: 'coleta' });
  assert.equal(s.length, 1);
  assert.equal(s[0].p, 1250);
  assert.equal(s[0].s, 'B');

  const today = '2026-10-31';
  const series: HistoryPoint[] = [];
  for (let i = 40; i >= 1; i--) series.push({ d: addDays(today, -i), p: 1300 + (i % 5) * 10, s: 'X', o: 'zoom' });
  series.push({ d: addDays(today, -8), p: 1100, s: 'Promo', o: 'pelando' });
  const sorted = series.reduce<HistoryPoint[]>((acc, p) => mergePoint(acc, p), []);
  const stats = seriesStats([...sorted, { d: today, p: 1200, s: 'Y', o: 'coleta' }], today);
  assert.equal(stats.min90, 1100);
  assert.equal(stats.allTimeLow?.price, 1100);
  assert.ok(stats.median30! > 1290 && stats.median30! < 1350);
  assert.equal(stats.days, 41);
});

test('Índice de Oferta: escala, mínimos e teto sem histórico', () => {
  assert.equal(labelFor(90), 'Imperdível');
  assert.equal(labelFor(72), 'Ótima');
  assert.equal(labelFor(60), 'Boa');
  assert.equal(labelFor(45), 'Na média');
  assert.equal(labelFor(10), 'Cara');

  const typical = scoreOffer({ price: 1300, store: 'Amazon' }, { median30: 1300, min90: 1150, days: 40 });
  assert.ok(typical.value >= 50 && typical.value <= 55, `típico ≈ 50 (veio ${typical.value})`);

  const newLow = scoreOffer({ price: 1099, store: 'Amazon' }, { median30: 1300, min90: 1150, allTimeLow: 1120, days: 40 });
  assert.equal(newLow.label, 'Imperdível');
  assert.equal(newLow.reasons[0], 'Menor preço já registrado');
  assert.ok(newLow.reasons.includes('Menor preço dos últimos 90 dias'));

  const noHistory = scoreOffer({ price: 900, store: 'Amazon' }, { marketMedian: 1400, days: 0 });
  assert.equal(noHistory.value, 69, 'sem histórico, no máximo "Boa"');

  const marketplace = scoreOffer({ price: 1300, store: 'Loja X', marketplace: true }, { median30: 1300, days: 40 });
  assert.ok(marketplace.value < typical.value);

  const inflated = scoreOffer({ price: 1300, listPrice: 2999, store: 'Amazon' }, { median30: 1300, days: 40 });
  assert.equal(inflated.inflatedListPrice, true);

  const conservative = scoreOffer({ price: 1200, store: 'Amazon' }, { median30: 1500, marketMedian: 1250, days: 40 });
  assert.match(conservative.reasons[0], /mediana das lojas agora/);
});

test('variantes e rótulos', () => {
  assert.equal(variantOf('galaxy-watch8', 44, 'lte'), '44mm-lte');
  assert.equal(variantOf('galaxy-watch8', undefined, 'bt'), 'tamx-bt');
  assert.equal(variantOf('xiaomi-watch2', undefined, 'bt'), 'padrao-bt');
  assert.equal(variantLabel('44mm-lte'), '44mm · LTE');
  assert.equal(variantLabel('padrao-bt'), 'Bluetooth');
});
