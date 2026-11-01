import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, PRIMARY_MODELS, familiesOf, getModel } from '../src/core/catalog.ts';
import { cheapestByStore, searchText, storeSearchLinks } from '../src/core/links.ts';

test('grupos: os 8 modelos configurados são os principais; os demais ficam ocultos', () => {
  assert.deepEqual(
    PRIMARY_MODELS.map((m) => m.id).sort(),
    ['galaxy-watch-fe', 'galaxy-watch-ultra', 'galaxy-watch4', 'galaxy-watch7', 'galaxy-watch8', 'ticwatch-pro5', 'xiaomi-watch2', 'xiaomi-watch2-pro'],
  );
  assert.equal(MODELS.length, 18);
  for (const m of MODELS) {
    assert.equal(getModel(m.family).family, m.family, `${m.id}: a linha aponta para um modelo-base`);
    assert.ok(m.query.length > 3, `${m.id}: termo de busca`);
  }
});

test('filtros por linha: Watch 2 Pro entra na linha do Xiaomi Watch 2; demais linhas só com "mostrar demais"', () => {
  assert.deepEqual(familiesOf(PRIMARY_MODELS), [
    'galaxy-watch-ultra', 'galaxy-watch8', 'galaxy-watch7', 'galaxy-watch-fe', 'galaxy-watch4', 'xiaomi-watch2', 'ticwatch-pro5',
  ]);
  const all = familiesOf(MODELS);
  for (const f of ['galaxy-watch9', 'galaxy-watch-ultra2', 'galaxy-watch6', 'galaxy-watch5', 'ticwatch-atlas'] as const) assert.ok(all.includes(f), f);
  assert.equal(new Set(all).size, all.length, 'sem linhas repetidas');
});

test('texto de busca usa tamanho e LTE da variante só quando fazem diferença', () => {
  assert.equal(searchText(getModel('galaxy-watch8'), '44mm-lte'), 'Galaxy Watch8 44mm LTE');
  assert.equal(searchText(getModel('galaxy-watch8'), '40mm-bt'), 'Galaxy Watch8 40mm');
  assert.equal(searchText(getModel('galaxy-watch8'), 'tamx-bt'), 'Galaxy Watch8');
  assert.equal(searchText(getModel('galaxy-watch-ultra'), '47mm-lte'), 'Galaxy Watch Ultra', 'só existe 47 mm LTE');
  assert.equal(searchText(getModel('xiaomi-watch2'), 'padrao-bt'), 'Xiaomi Watch 2');
  assert.equal(searchText(getModel('galaxy-watch-fe')), 'Galaxy Watch FE');
});

test('atalhos: ordenam por menor preço só onde dá para aplicar o piso do modelo', () => {
  const links = storeSearchLinks(getModel('galaxy-watch7'), '44mm-lte');
  const by = Object.fromEntries(links.map((l) => [l.store, l]));
  assert.equal(by['Mercado Livre'].url, 'https://lista.mercadolivre.com.br/galaxy-watch7-44mm-lte_OrderId_PRICE_PriceRange_550-0_NoIndex_True');
  assert.equal(by['Amazon'].url, 'https://www.amazon.com.br/s?k=Galaxy%20Watch7%2044mm%20LTE&s=price-asc-rank&rh=p_36%3A55000-');
  assert.equal(by['Google Shopping'].url, 'https://www.google.com/search?tbm=shop&q=Galaxy%20Watch7%2044mm%20LTE&tbs=p_ord%3Ap%2Cmr%3A1%2Cprice%3A1%2Cppr_min%3A550');
  assert.equal(by['Magazine Luiza'].url, 'https://www.magazineluiza.com.br/busca/Galaxy+Watch7+44mm+LTE/');
  assert.equal(by['Casas Bahia'].url, 'https://www.casasbahia.com.br/galaxy-watch7-44mm-lte/b');
  assert.equal(by['KaBuM!'].url, 'https://www.kabum.com.br/busca/galaxy-watch7-44mm-lte');
  assert.equal(by['Shopee'].url, 'https://shopee.com.br/search?keyword=Galaxy%20Watch7%2044mm%20LTE');
  for (const l of links) {
    assert.ok(new URL(l.url).protocol === 'https:', l.store);
    assert.equal(l.sortedByPrice, l.floor !== undefined, `${l.store}: ordenar por preço exige piso`);
  }
  assert.deepEqual(links.filter((l) => l.sortedByPrice).map((l) => l.store), ['Mercado Livre', 'Amazon', 'Google Shopping']);
});

test('onde comprar: uma linha por loja, da mais barata para a mais cara', () => {
  const offers = [
    { id: 'a', store: 'Amazon', price: 1500 },
    { id: 'b', store: 'KaBuM!', price: 1400 },
    { id: 'c', store: 'Amazon', price: 1450 },
    { id: 'd', store: 'Magazine Luiza', price: 1600 },
  ];
  assert.deepEqual(cheapestByStore(offers).map((o) => o.id), ['b', 'c', 'd']);
  assert.deepEqual(cheapestByStore([]), []);
});
