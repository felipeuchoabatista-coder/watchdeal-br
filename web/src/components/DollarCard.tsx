import { useMemo } from 'react';
import { DOLLAR_SOURCE_NAMES, dayChangePct, type DollarFile } from '../../../src/core/dolar.ts';
import { spDay } from '../../../src/core/text.ts';
import { pct2, rate2, rate4, useLiveDollar } from '../dolar.ts';
import { Sparkline } from './PriceChart.tsx';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** Cotação do dólar comercial, atualizada a cada minuto com o app aberto. */
export function DollarCard({ file, now }: { file: DollarFile | null; now: number }) {
  const { quote, live } = useLiveDollar(file);
  const daily = file?.daily;

  // 30 dias de fechamentos, terminando na cotação atual.
  const month = useMemo(() => {
    if (!quote) return [];
    const today = spDay(quote.at);
    const cutoff = spDay(now - 30 * 86_400_000);
    return [...(daily ?? []).filter((p) => p.d >= cutoff && p.d < today).map((p) => p.v), quote.sell];
  }, [daily, quote, now]);

  if (!quote) return null;
  const change = dayChangePct(quote, daily ?? []);
  const at = new Date(quote.at);
  const when = spDay(at) === spDay(now) ? `às ${timeFmt.format(at)}` : `em ${dayFmt.format(at)} às ${timeFmt.format(at)}`;
  const details = [
    quote.buy !== undefined && `Compra ${rate4(quote.buy)}`,
    quote.high !== undefined && `Máx. ${rate4(quote.high)}`,
    quote.low !== undefined && `Mín. ${rate4(quote.low)}`,
  ].filter(Boolean);
  const lo = Math.min(...month);
  const hi = Math.max(...month);

  return (
    <section className="dollar card" aria-labelledby="h-dollar">
      <div className="dollar__top">
        <h2 id="h-dollar" className="dollar__label">Dólar comercial</h2>
        <span className={`dollar__status${live ? ' is-live' : ''}`}>
          <span className="dollar__dot" aria-hidden />
          {live ? 'ao vivo' : 'última coleta'}
        </span>
      </div>
      <div className="dollar__main">
        <div className="dollar__now">
          <span className="dollar__value">{rate4(quote.sell)}</span>
          {change !== undefined && (
            <span className={`dollar__change ${change > 0 ? 'is-up' : change < 0 ? 'is-down' : ''}`}>
              {change > 0 ? '▲' : change < 0 ? '▼' : '='} {pct2(change)} no dia
            </span>
          )}
        </div>
        {month.length >= 2 && (
          <div className="dollar__trend">
            <Sparkline values={month} label={`Dólar nos últimos 30 dias: de ${rate2(lo)} a ${rate2(hi)}`} />
            <span className="dollar__range">30 dias: {rate2(lo)} a {rate2(hi)}</span>
          </div>
        )}
      </div>
      {details.length > 0 && <p className="dollar__details">{details.join(' · ')}</p>}
      <p className="dollar__source">
        {quote.source === 'coinbase' ? 'Taxa de mercado' : 'Venda'} · {DOLLAR_SOURCE_NAMES[quote.source]}, {when}
      </p>
    </section>
  );
}
