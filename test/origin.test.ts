import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectOrigin } from '../src/core/origin.ts';

// Títulos, lojas e vendedores reais das coletas (KaBuM!, Zoom/Magalu, Amazon) e casos típicos das comunidades.
type Case = { title: string; store: string; seller?: string; origin: 'nacional' | 'importado'; reason?: RegExp };

const CASES: Case[] = [
  // --- Importados ---
  { title: 'Xiaomi Watch 2 Black Versão Global Wear OS Google Maps GPS', store: 'Magazine Luiza', origin: 'importado', reason: /Versão global/ },
  { title: 'Smartwatch Xiaomi Watch 2 Wear OS by Google Bluetooth M2320W1 Black BHR8035GL (Versão Global)', store: 'Amazon', origin: 'importado', reason: /Versão global/ },
  { title: 'Xiaomi Watch 2 M2320W1 Preto Global Oferta Lançamento 2026', store: 'Magazine Luiza', origin: 'importado', reason: /Versão global/ },
  { title: 'Samsung Galaxy Watch 4 Classic Stainless Steel Smartwatch 46mm Lte - Preto-sm-r895uzkaxaa', store: 'KaBuM!', seller: 'New York Shop', origin: 'importado', reason: /americano.*SM-R895UZKAXAA/ },
  { title: 'Galaxy Watch9 44mm LTE SM-L355UZKAXAA', store: 'Mercado Livre', origin: 'importado', reason: /Modelo americano/ },
  { title: 'Galaxy Watch9 44mm BT SM-L350NZKAEUB', store: 'Mercado Livre', origin: 'importado', reason: /Modelo europeu/ },
  { title: 'Galaxy Watch Ultra SM-L705U Titanium Gray', store: 'Shopee', origin: 'importado', reason: /Modelo americano/ },
  { title: 'Mobvoi TicWatch Pro 5 Smartwatch Wear OS', store: 'AliExpress', origin: 'importado', reason: /Loja internacional/ },
  { title: 'Smartwatch Galaxy Watch7 44mm', store: 'KaBuM!', seller: 'Global Imports Store', origin: 'importado', reason: /Vendedor importador/ },
  { title: '[Internacional] Mobvoi TicWatch Atlas', store: 'AliExpress', origin: 'importado' },
  { title: '[Internacional] Xiaomi Watch 2 Pro 4G LTE', store: 'Shopee', origin: 'importado', reason: /Compra internacional/ },
  { title: 'TicWatch Pro 5 Enduro - Taxas inclusas', store: 'Mercado Livre', origin: 'importado', reason: /taxas/ },
  { title: 'Galaxy Watch6 Classic 47mm Importado Lacrado', store: 'Mercado Livre', origin: 'importado', reason: /importado/ },
  { title: 'TicWatch Atlas GPS (Enviado do exterior)', store: 'Amazon', origin: 'importado', reason: /exterior/ },
  // --- Nacionais ---
  { title: 'Smartwatch Samsung Galaxy Watch7 LTE 40mm - Creme SM-L305FZEAZTO', store: 'Magazine Luiza', origin: 'nacional' },
  { title: 'Galaxy Watch Ultra2 SM-L715FZSPZTO Titanium Silver', store: 'Samsung', origin: 'nacional' },
  { title: 'Smartwatch Samsung Galaxy Watch6 BT, 44mm, Prata - Sm-r940nzspzt', store: 'KaBuM!', seller: 'SHOPNEXT', origin: 'nacional' },
  { title: 'Samsung Galaxy Watch8 Smartwatch 44mm BT, Galaxy AI - Prata', store: 'Amazon', origin: 'nacional' },
  { title: 'Smartwatch Samsung Galaxy Watch4 BT SM-R860N 40,0 mm GPS', store: 'Fast Shop', origin: 'nacional' },
  { title: 'Xiaomi Watch 2 Versão Nacional Homologado', store: 'Xiaomi', origin: 'nacional' },
  { title: 'Smartwatch Galaxy Watch FE GPS Sistema de Posicionamento Global', store: 'Casas Bahia', origin: 'nacional' },
  { title: 'Usado - Galaxy Watch4 Bt, 44mm, Preto - Bom', store: 'KaBuM!', seller: 'Trocafone', origin: 'nacional' },
];

for (const c of CASES) {
  test(`${c.origin}: ${c.title} (${c.store}${c.seller ? ` / ${c.seller}` : ''})`, () => {
    const r = detectOrigin(c);
    assert.equal(r.origin, c.origin, `motivo: ${r.reason}`);
    if (c.origin === 'nacional') assert.equal(r.reason, undefined);
    if (c.reason) assert.match(r.reason ?? '', c.reason);
  });
}
