import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/core/matcher.ts';
import type { ClassificationKind, Condition, Connectivity, ModelId } from '../src/core/types.ts';

// Títulos reais coletados nas fontes (Zoom, Amazon, KaBuM, Samsung, Pelando, Promobit).
type Expect = {
  title: string;
  price?: number;
  kind: ClassificationKind;
  model?: ModelId;
  size?: number;
  conn?: Connectivity;
  condition?: Condition;
};

const CASES: Expect[] = [
  // --- Galaxy Watch8 ---
  { title: 'Samsung Galaxy Watch8 Smartwatch 40mm BT, Galaxy AI - Grafite', price: 1282.55, kind: 'device', model: 'galaxy-watch8', size: 40, conn: 'bt' },
  { title: 'Samsung Galaxy Watch8 Smartwatch 44mm LTE, Galaxy AI', price: 1632.14, kind: 'device', model: 'galaxy-watch8', size: 44, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch8 44,0 mm', price: 1529.1, kind: 'device', model: 'galaxy-watch8', size: 44, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch8 LTE 4G 40mm', price: 2321.19, kind: 'device', model: 'galaxy-watch8', size: 40, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch8 SM-L320 40mm - Grafite', price: 2759.99, kind: 'device', model: 'galaxy-watch8', size: 40, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch8 40mm Branco 32GB Bluetooth, Prata, Br', price: 1349.1, kind: 'device', model: 'galaxy-watch8', size: 40 },
  { title: '[Members] Galaxy Watch8 (Bluetooth, 44 mm)', price: 1169.1, kind: 'device', model: 'galaxy-watch8', size: 44, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch 8 LTE 44mm Grafite', price: 1296.28, kind: 'device', model: 'galaxy-watch8', size: 44, conn: 'lte' },
  { title: 'Samsung Galaxy Watch8 Smartwatch 44mm Lte, Galaxy Ai, Tela Em Cristal De Safira', price: 1709.1, kind: 'device', model: 'galaxy-watch8', size: 44, conn: 'lte' },
  // --- Watch8 Classic (oculto por padrão, mas identificado) ---
  { title: 'Samsung Galaxy Watch8 Classic Smartwatch 46mm LTE, Galaxy AI - Preto', price: 1994.05, kind: 'device', model: 'galaxy-watch8-classic', size: 46, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch8 Classic LTE 4G 46mm', price: 1889.1, kind: 'device', model: 'galaxy-watch8-classic' },
  // --- Galaxy Watch Ultra (só LTE, 47 mm: vale mesmo sem estar no título) ---
  { title: 'Samsung Galaxy Watch Ultra 2025 Smartwatch 47mm LTE', price: 1799.1, kind: 'device', model: 'galaxy-watch-ultra', size: 47, conn: 'lte' },
  { title: 'Samsung Galaxy Watch Ultra Smartwatch 47mm LTE 64GB 2GB RAM Galaxy AI Titânio Aeroespacial - Titânio Azul', price: 1685.95, kind: 'device', model: 'galaxy-watch-ultra', size: 47, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch Ultra Titânio Branco', price: 1899, kind: 'device', model: 'galaxy-watch-ultra', size: 47, conn: 'lte' },
  { title: 'Galaxy Watch Ultra SM-L705FZ Titânio Cinza', price: 2199, kind: 'device', model: 'galaxy-watch-ultra', size: 47, conn: 'lte' },
  // --- Galaxy Watch7 ---
  { title: 'Smartwatch Samsung Galaxy Watch7 Bluetooth 44mm', price: 1449, kind: 'device', model: 'galaxy-watch7', size: 44, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch7 40mm Verde', price: 1099.99, kind: 'device', model: 'galaxy-watch7', size: 40, conn: 'bt' },
  { title: 'Samsung Galaxy Watch7 Smartwatch 40mm LTE, Galaxy AI - Verde', price: 1299, kind: 'device', model: 'galaxy-watch7', size: 40, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch 7 SM-L310 Prata', price: 1199, kind: 'device', model: 'galaxy-watch7', size: 44, conn: 'bt' },
  // --- Galaxy Watch6 e Watch6 Classic ---
  { title: 'Smartwatch Samsung Galaxy Watch6 Bt 40mm, Tela Amoled De 1.31", Monitoramento de Saúde Completo, Grafite', price: 1430.67, kind: 'device', model: 'galaxy-watch6', size: 40, conn: 'bt' },
  { title: 'Samsung Galaxy Watch 6 LTE 44mm Prata', price: 1099, kind: 'device', model: 'galaxy-watch6', size: 44, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch6 Classic Bt 47mm Preto', price: 1599, kind: 'device', model: 'galaxy-watch6-classic', size: 47, conn: 'bt' },
  { title: 'Galaxy Watch 6 Classic LTE SM-R955 Prata', price: 1499, kind: 'device', model: 'galaxy-watch6-classic', size: 43, conn: 'lte' },
  // --- Galaxy Watch5 e Watch5 Pro ---
  { title: 'Samsung Galaxy Watch 5 Bt, 40mm, Tela Super Amoled 1.2" - Grafite.', price: 1749.97, kind: 'device', model: 'galaxy-watch5', size: 40, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch5 LTE 44mm Safira', price: 999, kind: 'device', model: 'galaxy-watch5', size: 44, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch5 Pro LTE 45mm Titânio Preto', price: 1799, kind: 'device', model: 'galaxy-watch5-pro', size: 45, conn: 'lte' },
  { title: 'Samsung Galaxy Watch 5 Pro Bluetooth Titânio Cinza', price: 1599, kind: 'device', model: 'galaxy-watch5-pro', size: 45, conn: 'bt' },
  // --- Galaxy Watch4 ---
  { title: 'Smartwatch Samsung Galaxy Watch4 BT SM-R860N 40,0 mm GPS', price: 1349.1, kind: 'device', model: 'galaxy-watch4', size: 40, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch4 BT SM-R870N 44,0 mm GPS', price: 1529.1, kind: 'device', model: 'galaxy-watch4', size: 44, conn: 'bt' },
  { title: 'Smartwatch Samsung Galaxy Watch 4 Bt 44mm, Preto', price: 1444.33, kind: 'device', model: 'galaxy-watch4', size: 44 },
  { title: 'Smartwatch Samsung Galaxy, Watch 4 LTE 44Mm, Preto', price: 1337.97, kind: 'device', model: 'galaxy-watch4', size: 44, conn: 'lte' },
  { title: 'Usado - Galaxy Watch4 Bt, 44mm, Preto - Bom', price: 439, kind: 'device', model: 'galaxy-watch4', size: 44, condition: 'usado' },
  { title: 'Galaxy Watch4 40mm Recondicionado Excelente', price: 520, kind: 'device', model: 'galaxy-watch4', condition: 'recondicionado' },
  // --- Watch4 Classic ---
  { title: 'Smartwatch Samsung Galaxy Watch4 Classic LTE SM-R885FZ 4G 42,0 mm GPS', price: 999, kind: 'device', model: 'galaxy-watch4-classic', size: 42, conn: 'lte' },
  { title: 'Smartwatch Samsung Galaxy Watch 4 Classic Bt, 42mm, Prata', price: 1440.97, kind: 'device', model: 'galaxy-watch4-classic', size: 42 },
  // --- Galaxy Watch FE ---
  { title: 'Smartwatch Samsung Galaxy Watch FE 40mm Bluetooth Preto', price: 899, kind: 'device', model: 'galaxy-watch-fe', size: 40, conn: 'bt' },
  { title: 'Samsung Galaxy Watch FE, Smartwatch 40mm BT, Tela Super AMOLED de 1.2", Rosa', price: 949, kind: 'device', model: 'galaxy-watch-fe', size: 40 },
  { title: 'Galaxy Watch FE LTE SM-R866 Prata', price: 1099, kind: 'device', model: 'galaxy-watch-fe', size: 40, conn: 'lte' },
  // --- Xiaomi Watch 2 ---
  { title: 'Smartwatch Xiaomi Watch 2 GPS', price: 939.37, kind: 'device', model: 'xiaomi-watch2' },
  { title: 'Xiaomi Watch 2 Black Versão Global Wear OS Google Maps GPS', price: 890.45, kind: 'device', model: 'xiaomi-watch2' },
  { title: 'Smartwatch Xiaomi Watch 2 M2320W1 Global Oferta Relâmpago', price: 890.45, kind: 'device', model: 'xiaomi-watch2' },
  { title: 'Xiaomi Watch 2 Pro LTE Preto', price: 1499, kind: 'device', model: 'xiaomi-watch2-pro', conn: 'lte' },
  // --- Mobvoi TicWatch (só Bluetooth; "compatível com Android" descreve o relógio) ---
  { title: 'Smartwatch Mobvoi TicWatch Pro 5 Wear OS GPS Preto', price: 1899, kind: 'device', model: 'ticwatch-pro5', conn: 'bt' },
  { title: 'Mobvoi TicWatch Pro 5 Relógio Inteligente para Homens, Snapdragon W5+ Gen 1, 80 Horas de Bateria, Somente Compatível com Android', price: 2199, kind: 'device', model: 'ticwatch-pro5', conn: 'bt' },
  { title: 'Tic Watch Pro5 GPS Smartwatch', price: 1799, kind: 'device', model: 'ticwatch-pro5' },
  { title: 'Mobvoi TicWatch Pro 5 Enduro Smartwatch Wear OS Cinza', price: 2099, kind: 'device', model: 'ticwatch-pro5-enduro', conn: 'bt' },
  { title: 'Smartwatch Mobvoi TicWatch Atlas Wear OS GPS 90 Horas Preto', price: 2299, kind: 'device', model: 'ticwatch-atlas', conn: 'bt' },
  { title: 'Mobvoi TicWatch Atlas Smartwatch GPS, Compatível com Smartphones Android', price: 2199, kind: 'device', model: 'ticwatch-atlas' },
  { title: 'Smartwatch Samsung Galaxy Watch FE 40mm Bluetooth Compatível com Android', price: 899, kind: 'device', model: 'galaxy-watch-fe', size: 40 },
  // --- Acessórios: nunca podem virar relógio ---
  { title: 'Pulseira de Milanese Para Galaxy Watch 4/ Galaxy Watch4 Classic - Prata', price: 39.9, kind: 'accessory' },
  { title: 'Pelicula De Vidro Temperado Galaxy Watch 4 Watch4 Classic 40mm - 123smart', price: 19.9, kind: 'accessory' },
  { title: '2 Peliculas De Vidro Temperado Galaxy Watch 4 Watch4 Classic - 42mm', price: 24.9, kind: 'accessory' },
  { title: 'Capa Case Com Coroa Para Galaxy Watch 4 Classic 42mm/ Watch4 Classic 46mm', price: 49.9, kind: 'accessory' },
  { title: 'Pulseira Sport Galaxy Watch8 (P/M)', price: 349, kind: 'accessory' },
  { title: 'Fecho da Pulseira Galaxy Watch 4', price: 120, kind: 'accessory' },
  { title: 'Cabo de Carregamento Wireless Galaxy Watch', price: 120, kind: 'other' },
  { title: 'Pulseira De Couro Para Xiaomi Watch 2 pro Mi Watch S3 S1 Active pro S2', price: 42.98, kind: 'other' },
  { title: 'Relogio Compativel Samsung Galaxy Watch 8 Bluetooth Top', price: 232.46, kind: 'accessory' },
  { title: 'Kit 3 Películas Hidrogel Galaxy Watch FE 40mm', price: 29.9, kind: 'accessory' },
  { title: 'Carregador Magnético Galaxy Watch 8 Watch FE Watch 4', price: 59.9, kind: 'accessory' },
  { title: 'Samsung Galaxy Watch8 Bumper transparente 44mm', price: 89, kind: 'accessory' },
  { title: 'Pulseira Silicone Galaxy Watch Ultra 47mm Laranja', price: 59.9, kind: 'accessory' },
  { title: 'Capa Bumper Galaxy Watch6 Classic 47mm', price: 39.9, kind: 'accessory' },
  { title: 'Película Hidrogel TicWatch Pro 5 Kit 3', price: 29.9, kind: 'accessory' },
  { title: 'Carregador Magnético para TicWatch Pro 5 Enduro Atlas', price: 49.9, kind: 'accessory' },
  { title: 'Relógio Compatível Tic Watch Pro 5 Bluetooth', price: 199, kind: 'accessory' },
  { title: 'Kit Pulseira Para Mobvoi TicWatch Atlas 24mm', price: 39.9, kind: 'accessory' },
  // --- Clones e outros modelos ---
  { title: 'Relógio Smartwatch HW8 Ultra 49mm Watch 8  - SVD Store', price: 251.28, kind: 'clone' },
  { title: 'Relogio Inteligente W28 Pro Smartwatch Global Unissex Watch 8 Masculino', price: 172.9, kind: 'clone' },
  { title: 'Relógio Digital Smartwatch Watch 8 Pro Tamanho 45mm Unissex - Microwear', price: 188.9, kind: 'clone' },
  { title: 'Relógio Smartwatch Ecossistema Xiaomi,Haylou Watch 2 Pro A Prova Dagua', price: 272.15, kind: 'clone' },
  { title: 'Relógio Smartwatch Watch 7 Ultra 49mm - Microwear', price: 199, kind: 'clone' },
  { title: 'Smartwatch Samsung Galaxy Watch9 40,0 mm', price: 2339.1, kind: 'other' },
  { title: 'Smartwatch Samsung Galaxy Watch Ultra 2 47mm', price: 3999, kind: 'other' },
  { title: 'Smartwatch Samsung Galaxy Watch 46mm Bluetooth (2018)', price: 699, kind: 'other' },
  { title: 'Smartwatch Xiaomi Redmi Watch 5 Active', price: 246.82, kind: 'other' },
  { title: 'Smartwatch Xiaomi Smart Band 10', price: 309.9, kind: 'other' },
  { title: 'Smartwatch Xiaomi Watch S5 46mm', price: 2599.99, kind: 'other' },
  { title: 'Smartwatch Xiaomi Watch 5, com NFC para pagamentos, GPS integrado, WiF', price: 2753.96, kind: 'other' },
  { title: 'Smartwatch Xiaomi Redmi Watch 6', price: 465.41, kind: 'other' },
  { title: 'Smartwatch Mobvoi TicWatch Pro 3 Ultra GPS', price: 1299, kind: 'other' },
  { title: 'Mobvoi TicWatch E3 Wear OS', price: 899, kind: 'other' },
  // --- Combos ---
  { title: 'Galaxy A57 5G (128GB) - Cinza + Galaxy Watch8 BT 40mm - Grafite', price: 6298, kind: 'bundle' },
  { title: 'Samsung Galaxy S25+ 512GB + Watch9 BT 44mm', price: 5262.11, kind: 'other' },
  { title: 'Kit Galaxy Watch FE + Galaxy Buds FE', price: 1299, kind: 'bundle' },
  { title: 'Galaxy Watch7 44mm + Galaxy Buds3 Pro', price: 2199, kind: 'bundle' },
  // --- Listas de compatibilidade e preço implausível ---
  { title: 'Samsung Galaxy Watch 4 5 6 Relógio Smart', price: 899, kind: 'ambiguous' },
  { title: 'Samsung Galaxy Watch 7 6 5 Relógio Smart', price: 899, kind: 'ambiguous' },
  { title: 'Galaxy Watch7 e Galaxy Watch Ultra com desconto', price: 1500, kind: 'ambiguous' },
  { title: 'Smartwatch Samsung Galaxy Watch Ultra 47mm', price: 299, kind: 'implausible' },
  { title: 'Smartwatch Samsung Galaxy Watch8 40mm', price: 199, kind: 'implausible' },
];

for (const c of CASES) {
  test(`${c.kind}: ${c.title}`, () => {
    const r = classify({ title: c.title, price: c.price });
    assert.equal(r.kind, c.kind, `motivo: ${r.reason}`);
    if (c.model) assert.equal(r.model, c.model);
    if (c.size !== undefined) assert.equal(r.size, c.size);
    if (c.conn) assert.equal(r.connectivity, c.conn);
    assert.equal(r.condition, c.condition ?? 'novo');
  });
}

test('condição informada pela fonte prevalece sobre o título', () => {
  const r = classify({ title: 'Galaxy Watch4 Bt 40mm Preto', price: 600, conditionHint: 'recondicionado' });
  assert.equal(r.kind, 'device');
  assert.equal(r.condition, 'recondicionado');
});
