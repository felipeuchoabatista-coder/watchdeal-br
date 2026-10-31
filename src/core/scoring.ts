import { round2 } from './text.ts';
import type { Score, ScoreLabel } from './types.ts';

/** Lojas oficiais / venda direta: mais garantia e troca sem dor de cabeça. */
const TRUSTED_STORES = /^(samsung|amazon|kabum|magazine luiza|magalu|fast shop|casas bahia|ponto|americanas|carrefour|mercado livre|xiaomi|mi store)/i;

export interface ScoreInput {
  price: number;
  listPrice?: number;
  store: string;
  marketplace?: boolean;
  community?: { temperature?: number; likes?: number };
}

export interface ScoreRef {
  median30?: number;
  min90?: number;
  allTimeLow?: number;
  /** Mediana dos preços atuais da mesma variante em outras lojas. */
  marketMedian?: number;
  days: number;
}

export function labelFor(value: number): ScoreLabel {
  if (value >= 85) return 'Imperdível';
  if (value >= 70) return 'Ótima';
  if (value >= 55) return 'Boa';
  if (value >= 40) return 'Na média';
  return 'Cara';
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (f: number) => `${Math.abs(Math.round(f * 100))}%`;

/**
 * Índice de Oferta (0–100). 50 = preço típico. Cada 1% abaixo da referência
 * soma 2,5 pontos; mínimos históricos e confiança no vendedor ajustam o resto.
 */
export function scoreOffer(input: ScoreInput, ref: ScoreRef): Score {
  const reasons: string[] = [];
  // Referência conservadora: se o mercado de agora está abaixo da mediana histórica,
  // compara com o mercado — "Imperdível" precisa ser imperdível de verdade.
  const useMarket = ref.marketMedian !== undefined && (ref.median30 === undefined || ref.marketMedian < ref.median30);
  const baseline = useMarket ? ref.marketMedian : ref.median30;
  let value = 50;

  if (baseline) {
    const d = (baseline - input.price) / baseline;
    value += d * 250;
    const basis = useMarket ? 'da mediana das lojas agora' : 'da mediana de 30 dias';
    if (Math.abs(d) >= 0.01) reasons.push(`${pct(d)} ${d > 0 ? 'abaixo' : 'acima'} ${basis} (${brl(baseline)})`);
    else reasons.push(`No preço típico ${basis}`);
  }
  if (!ref.median30) reasons.push('Histórico em formação: comparação com as outras lojas');

  if (ref.min90 !== undefined) {
    if (input.price < ref.min90) {
      value += 15;
      reasons.unshift('Menor preço dos últimos 90 dias');
    } else if (input.price <= ref.min90 * 1.03) {
      value += 7;
      reasons.push(`Perto do menor preço de 90 dias (${brl(ref.min90)})`);
    }
  }
  if (ref.allTimeLow !== undefined && input.price < ref.allTimeLow) {
    value += 5;
    reasons.unshift('Menor preço já registrado');
  }

  if (input.marketplace) {
    value -= 5;
    reasons.push('Vendido por terceiro (marketplace)');
  } else if (TRUSTED_STORES.test(input.store)) {
    value += 3;
  }

  const temp = input.community?.temperature ?? 0;
  const likes = input.community?.likes ?? 0;
  if (temp >= 500 || likes >= 50) {
    value += 3;
    reasons.push('Bem avaliada pela comunidade');
  }

  let inflatedListPrice = false;
  if (input.listPrice && baseline && input.listPrice > baseline * 1.25 && input.listPrice > input.price * 1.2) {
    inflatedListPrice = true;
    reasons.push(`Preço "de" ${brl(input.listPrice)} parece inflado`);
  }

  // Sem histórico não dá para afirmar que é a melhor oferta: teto em "Boa".
  const hasHistory = ref.median30 !== undefined || ref.min90 !== undefined;
  const ceiling = hasHistory ? 100 : 69;
  if (!hasHistory && value > ceiling) reasons.push('Teto em "Boa" até haver histórico suficiente');
  const final = Math.max(0, Math.min(ceiling, Math.round(value)));
  return {
    value: final,
    label: labelFor(final),
    reasons,
    ref: {
      median30: ref.median30 && round2(ref.median30),
      min90: ref.min90,
      allTimeLow: ref.allTimeLow,
      marketMedian: ref.marketMedian && round2(ref.marketMedian),
    },
    inflatedListPrice: inflatedListPrice || undefined,
  };
}
