import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AWESOME_URL, COINBASE_URL, dayChangePct, dollarOn, fetchQuote, mergeDollar, parseAwesome, parseCoinbase,
  parsePtax, parseSgs, previousClose, ptaxUrl, sgsUrl, type DollarFile, type GetJson,
} from '../src/core/dolar.ts';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as unknown;
const now = new Date('2026-11-04T18:53:00Z');

test('lê a cotação da AwesomeAPI, da Coinbase e do Banco Central', () => {
  const awesome = parseAwesome(fx('dolar-awesome.json'), now);
  assert.deepEqual(awesome, {
    sell: 5.4618, buy: 5.4612, high: 5.4952, low: 5.4521, changePct: -0.29,
    at: '2026-11-04T18:52:25.000Z', source: 'awesomeapi',
  });

  const coinbase = parseCoinbase(fx('dolar-coinbase.json'), now);
  assert.equal(coinbase.sell, 5.46175);
  assert.equal(coinbase.at, now.toISOString(), 'sem horário na resposta: usa o da consulta');

  // Último boletim do dia (Fechamento PTAX), no horário de Brasília.
  const ptax = parsePtax(fx('dolar-ptax.json'));
  assert.deepEqual(ptax, { sell: 5.4778, buy: 5.4772, at: '2026-11-04T16:05:19.000Z', source: 'bcb' });
});

test('recusa respostas sem cotação válida', () => {
  assert.throws(() => parseAwesome({ status: 429, code: 'QuotaExceeded' }, now));
  assert.throws(() => parseAwesome({ USDBRL: { ask: '0', bid: '0' } }, now));
  assert.throws(() => parseAwesome({ USDBRL: { ask: '1547.5' } }, now), 'valor absurdo (outra moeda)');
  assert.throws(() => parseCoinbase({ data: { currency: 'EUR', rates: { BRL: '6.1' } } }, now));
  assert.throws(() => parsePtax({ value: [] }), 'fim de semana: sem boletim');
});

test('histórico diário do Banco Central (SGS)', () => {
  const daily = parseSgs(fx('dolar-sgs.json'));
  assert.equal(daily.length, 23);
  assert.deepEqual(daily.at(-1), { d: '2026-11-04', v: 5.4778 });
  assert.deepEqual(daily.at(-2), { d: '2026-11-03', v: 5.4935 });
  assert.ok(daily.every((p, i) => i === 0 || daily[i - 1].d < p.d), 'em ordem');
  assert.throws(() => parseSgs({ erro: 'x' }));
  assert.equal(sgsUrl('2025-04-23', '2026-11-04').includes('dataInicial=23/04/2025&dataFinal=04/11/2026'), true);
  assert.equal(ptaxUrl('2026-11-04').includes("@dataCotacao='11-04-2026'"), true);
});

test('usa a próxima fonte quando uma falha', async () => {
  const calls: string[] = [];
  const answers: Record<string, unknown> = {
    [COINBASE_URL]: fx('dolar-coinbase.json'),
    [ptaxUrl('2026-11-04')]: fx('dolar-ptax.json'),
  };
  const get: GetJson = async (url) => {
    calls.push(url);
    if (url.startsWith(AWESOME_URL)) throw new Error('economia.awesomeapi.com.br respondeu 429');
    if (url in answers) return answers[url];
    throw new Error('fora do ar');
  };
  const quote = await fetchQuote(get, now);
  assert.equal(quote.source, 'coinbase');
  assert.deepEqual(calls, [AWESOME_URL, COINBASE_URL]);

  delete answers[COINBASE_URL];
  assert.equal((await fetchQuote(get, now)).source, 'bcb');

  delete answers[ptaxUrl('2026-11-04')];
  await assert.rejects(fetchQuote(get, now), /AwesomeAPI: .*429.*Coinbase: fora do ar.*Banco Central: fora do ar/);

  // Com a chave, a AwesomeAPI é chamada com ela (sem cache e sem limite por IP).
  calls.length = 0;
  await fetchQuote(async (url) => (calls.push(url), fx('dolar-awesome.json')), now, 'abc 123');
  assert.deepEqual(calls, [`${AWESOME_URL}?token=abc%20123`]);
});

test('junta cotação e histórico ao arquivo anterior', () => {
  const prev: DollarFile = {
    generatedAt: '2026-11-04T18:00:00Z',
    current: { sell: 5.47, at: '2026-11-04T18:00:00Z', source: 'coinbase' },
    daily: [{ d: '2026-11-03', v: 5.49 }, { d: '2026-10-30', v: 5.4212 }],
    dailyUpdatedAt: '2026-11-04T12:00:00Z',
  };
  const quote = parseAwesome(fx('dolar-awesome.json'), now);

  const onlyQuote = mergeDollar(prev, { quote }, now);
  assert.equal(onlyQuote.current, quote);
  assert.deepEqual(onlyQuote.daily.map((p) => p.d), ['2026-10-30', '2026-11-03'], 'ordenado por dia');
  assert.equal(onlyQuote.dailyUpdatedAt, prev.dailyUpdatedAt);

  const withDaily = mergeDollar(prev, { daily: [{ d: '2026-11-03', v: 5.4935 }, { d: '2026-11-04', v: 5.4778 }] }, now);
  assert.equal(withDaily.current, prev.current, 'sem cotação nova, mantém a anterior');
  assert.deepEqual(withDaily.daily, [{ d: '2026-10-30', v: 5.4212 }, { d: '2026-11-03', v: 5.4935 }, { d: '2026-11-04', v: 5.4778 }]);
  assert.equal(withDaily.dailyUpdatedAt, now.toISOString());

  const long = mergeDollar(null, { daily: Array.from({ length: 450 }, (_, i) => ({ d: `2025-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, v: 5 })) }, now);
  assert.equal(long.daily.length, 400, 'guarda só os 400 dias mais recentes');
});

test('fechamento anterior, dólar de um dia e variação no dia', () => {
  const daily = parseSgs(fx('dolar-sgs.json'));
  assert.equal(previousClose(daily, '2026-11-04'), 5.4935);
  assert.equal(previousClose(daily, '2026-11-03'), 5.4212, 'segunda-feira compara com sexta');
  assert.equal(dollarOn(daily, '2026-11-01'), 5.4212, 'domingo usa o fechamento de sexta');
  assert.equal(dollarOn(daily, '2026-11-04'), 5.4778);
  assert.equal(dollarOn(daily, '2020-01-01'), undefined);

  assert.equal(dayChangePct(parseAwesome(fx('dolar-awesome.json'), now), daily), -0.29, 'usa a variação da fonte');
  const coinbase = parseCoinbase(fx('dolar-coinbase.json'), now);
  assert.equal(dayChangePct(coinbase, daily)?.toFixed(3), ((5.46175 / 5.4935 - 1) * 100).toFixed(3), 'calcula contra o fechamento anterior');
  assert.equal(dayChangePct(coinbase, []), undefined);
});
