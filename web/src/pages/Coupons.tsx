import { useMemo, useState } from 'react';
import type { Coupon } from '../../../src/core/types.ts';
import { Chip, Empty } from '../components/bits.tsx';
import { CouponCard } from '../components/cards.tsx';
import type { AppData } from '../data.ts';

const SCOPES: { id: Coupon['scope'] | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'modelo', label: 'Para os relógios' },
  { id: 'smartwatch', label: 'Smartwatches' },
  { id: 'loja', label: 'Site todo' },
];

export function Coupons({ data, now }: { data: AppData; now: number }) {
  const [scope, setScope] = useState<Coupon['scope'] | 'todos'>('todos');
  const [store, setStore] = useState<string>('todas');

  const stores = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of data.coupons) count.set(c.store, (count.get(c.store) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.coupons]);

  const list = data.coupons.filter((c) => (scope === 'todos' || c.scope === scope) && (store === 'todas' || c.store === store));

  return (
    <div className="page">
      <h1 className="page-title">Cupons</h1>
      <p className="muted small">
        Cupons ativos das lojas que vendem os relógios, coletados do Promobit e das ofertas da comunidade. Cupom de outras categorias (moda, games, móveis…) é descartado automaticamente.
      </p>
      <div className="chips" role="group" aria-label="Tipo de cupom">
        {SCOPES.map((s) => (
          <Chip key={s.id} active={scope === s.id} onClick={() => setScope(s.id)} count={s.id === 'todos' ? data.coupons.length : data.coupons.filter((c) => c.scope === s.id).length}>
            {s.label}
          </Chip>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Loja">
        <Chip active={store === 'todas'} onClick={() => setStore('todas')}>Todas as lojas</Chip>
        {stores.map(([name, n]) => (
          <Chip key={name} active={store === name} onClick={() => setStore(name)} count={n}>
            {name}
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty title="Nenhum cupom neste filtro">Os cupons são atualizados a cada hora.</Empty>
      ) : (
        <div className="coupons">
          {list.map((c) => (
            <CouponCard key={c.id} coupon={c} now={now} />
          ))}
        </div>
      )}
      <p className="muted small disclaimer">Cupons podem ter regras (valor mínimo, limite de uso, só no app). Confira na loja antes de finalizar.</p>
    </div>
  );
}
