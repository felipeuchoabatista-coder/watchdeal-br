import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAmazonSearch } from '../src/sources/amazon.ts';
import { parseKabum } from '../src/sources/kabum.ts';
import { decodeAstro, parsePelandoSearch, pelandoToResult } from '../src/sources/pelando.ts';
import { couponsFromOffers, parsePromobitCoupons, parsePromobitOffers } from '../src/sources/promobit.ts';
import { parseSamsungProducts } from '../src/sources/samsung.ts';
import { parseZoomProduct, parseZoomSearch } from '../src/sources/zoom.ts';
import { classifyRaw } from '../src/pipeline.ts';
import { BlockedError } from '../src/core/http.ts';
import { fetchAllTolerant } from '../src/sources/source.ts';

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Zoom: busca traz produtos do catálogo e ofertas avulsas com link de loja', () => {
  const r = parseZoomSearch(fx('zoom-busca.html'));
  assert.ok(r.products.some((p) => p.name === 'Smartwatch Xiaomi Watch 2 GPS'));
  const offer = r.offers.find((o) => o.title.startsWith('Xiaomi Watch 2 Black'));
  assert.ok(offer, 'oferta avulsa do Xiaomi Watch 2');
  assert.equal(offer.store, 'Magazine Luiza');
  assert.equal(offer.price, 890.45);
  assert.match(offer.url, /^https:\/\/www\.zoom\.com\.br\/lead\?oid=\d+$/);
});

test('Zoom: página de produto traz ofertas por loja e histórico diário', () => {
  const r = parseZoomProduct(fx('zoom-produto.html'), { name: 'x', path: '/x' });
  assert.ok(r.offers.length >= 3);
  const magalu = r.offers.find((o) => o.store === 'Magazine Luiza');
  assert.ok(magalu);
  assert.equal(magalu.price, 1349.1);
  assert.equal(magalu.priceCard, 1499, 'preço parcelado separado do à vista');
  assert.equal(new Set(r.offers.map((o) => o.sourceOfferId)).size, r.offers.length, 'sem ofertas repetidas');
  assert.ok(r.history && r.history.points.length >= 30);
  assert.ok(r.history.points.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.d) && p.p > 500));
  assert.ok(r.history.points.some((p) => p.s === 'Amazon'), 'loja do histórico resolvida pelo merchantId');
});

test('Samsung: preço Pix vem da tabela de parcelas e combos/pulseiras ficam de fora na classificação', () => {
  const offers = parseSamsungProducts(JSON.parse(fx('samsung.json')));
  const w8 = offers.find((o) => o.title.includes('Watch8 Smartwatch 40mm BT'));
  assert.ok(w8);
  assert.equal(w8.priceCard, 2499);
  assert.ok(w8.price < 2499, 'Pix com desconto');
  assert.equal(w8.store, 'Samsung');
  assert.equal(classifyRaw(w8).model, 'galaxy-watch8');
  for (const o of offers.filter((x) => /Pulseira|\+ Galaxy Watch8/.test(x.title))) {
    assert.notEqual(classifyRaw(o).kind, 'device', o.title);
  }
});

test('KaBuM: Pix, cartão, usados e vendedores de marketplace', () => {
  const offers = parseKabum(JSON.parse(fx('kabum.json')).data);
  const used = offers.find((o) => o.title.startsWith('Usado'));
  assert.ok(used);
  assert.equal(classifyRaw(used).condition, 'usado');
  const w8 = offers.find((o) => /Watch8 Smartwatch 44mm Lte/i.test(o.title));
  assert.ok(w8);
  assert.equal(w8.price, 1709.1);
  assert.equal(w8.priceCard, 1899);
  assert.equal(w8.seller, 'Magalu');
  assert.equal(w8.marketplace, true);
  assert.match(w8.url, /^https:\/\/www\.kabum\.com\.br\/produto\/\d+\//);
  assert.ok(offers.every((o) => o.installments === undefined || o.installments.n > 1));
});

test('Amazon: ASIN, preço atual e título limpo', () => {
  const r = parseAmazonSearch(fx('amazon.html'));
  assert.ok(r.offers.length >= 5);
  const first = r.offers[0];
  assert.match(first.sourceOfferId, /^[A-Z0-9]{10}$/);
  assert.equal(first.url, `https://www.amazon.com.br/dp/${first.sourceOfferId}`);
  assert.ok(r.offers.every((o) => o.price > 100 && !/patrocinado/i.test(o.title)));
  assert.ok(r.offers.some((o) => classifyRaw(o).model === 'galaxy-watch8'));
});

test('Amazon: página intermediária sem resultados conta como bloqueio, não como "zero ofertas"', () => {
  assert.throws(
    () => parseAmazonSearch('<html><body><form action="/errors/validateCaptcha">Continuar comprando</form></body></html>'),
    BlockedError,
  );
});

test('fontes: bloqueio interrompe as consultas seguintes ao mesmo site', async () => {
  const ran: string[] = [];
  const task = (label: string, fail?: Error) => ({
    label,
    run: async () => {
      ran.push(label);
      if (fail) throw fail;
      return label;
    },
  });
  const r = await fetchAllTolerant([task('a'), task('b', new BlockedError('x')), task('c')]);
  assert.deepEqual(r.results, ['a']);
  assert.deepEqual(ran, ['a', 'b']);
  await assert.rejects(fetchAllTolerant([task('d', new BlockedError('y')), task('e')]), BlockedError);
});

test('Pelando: decodifica props do Astro; ativas viram ofertas e expiradas viram histórico', () => {
  assert.deepEqual(decodeAstro([0, { a: [0, 1], b: [1, [[0, 'x']]] }]), { a: 1, b: ['x'] });
  const deals = parsePelandoSearch(fx('pelando.html'));
  assert.ok(deals.length >= 10);
  const { offers, history } = pelandoToResult(deals);
  assert.ok(offers.every((o) => o.discussionUrl?.startsWith('https://www.pelando.com.br/d/')));
  assert.ok(offers.every((o) => o.community?.temperature !== undefined));
  const w8 = history.find((h) => h.title === 'Smartwatch Samsung Galaxy Watch8 40mm BT Grafite');
  assert.ok(w8, 'oferta expirada do Watch8 entra como histórico');
  assert.equal(w8.points[0].o, 'pelando');
});

test('Promobit: ofertas com cupom e mural de cupons filtrado', () => {
  const { offers } = parsePromobitOffers(JSON.parse(fx('promobit-ofertas.json')).offers);
  const magalu = offers.find((o) => o.coupon?.code === 'RELOGIO100');
  assert.ok(magalu, 'código de cupom preservado');
  assert.equal(magalu.store, 'Magazine Luiza');
  assert.match(magalu.discussionUrl!, /^https:\/\/www\.promobit\.com\.br\/oferta\/.+-\d+\/$/);
  const shopee = offers.find((o) => o.coupon?.description === 'Cupom R$120 Off');
  assert.ok(shopee);
  assert.equal(shopee.coupon?.value, 120);

  const now = new Date('2026-10-31T15:00:00Z');
  const coupons = parsePromobitCoupons(JSON.parse(fx('promobit-cupons.json')).coupons, now);
  assert.ok(coupons.length > 0);
  assert.ok(coupons.every((c) => c.code && c.scope));
  assert.ok(!coupons.some((c) => /Renner|gamer/i.test(c.title)), 'cupons de outras categorias descartados');
  const fromOffers = couponsFromOffers(offers);
  assert.ok(fromOffers.some((c) => c.code === 'RELOGIO100' && c.models.includes('galaxy-watch8')));
});
