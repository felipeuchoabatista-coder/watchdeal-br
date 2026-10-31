import type { CSSProperties } from 'react';
import { getModel, variantLabel } from '../../../src/core/catalog.ts';
import type { Coupon, ModelSummary, Offer } from '../../../src/core/types.ts';
import { ago, brl, brl0, pct, SOURCE_NAMES, untilText, useHistory } from '../data.ts';
import { CopyButton, ScoreBadge } from './bits.tsx';
import { Icon } from './Icon.tsx';
import { Sparkline } from './PriceChart.tsx';

const COMMUNITY_FRESH_MS = 72 * 3_600_000;

const CONDITION: Record<Offer['condition'], string> = {
  novo: 'Novo',
  usado: 'Usado',
  recondicionado: 'Recondicionado/vitrine',
};

export function OfferCard({ offer, now, target, showModel = true }: { offer: Offer; now: number; target?: number; showModel?: boolean }) {
  const spec = getModel(offer.model);
  const stale = offer.postedAt && now - new Date(offer.postedAt).getTime() > COMMUNITY_FRESH_MS;
  const ends = offer.endsAt ? untilText(offer.endsAt, now) : null;
  const belowTarget = target !== undefined && offer.price <= target;
  const reason = offer.score.reasons.find((r) => !r.startsWith('Histórico em formação')) ?? offer.score.reasons[0];

  return (
    <article className={`offer${belowTarget ? ' offer--target' : ''}`} style={{ '--accent': spec.color } as CSSProperties}>
      <div className="offer__media">
        {offer.image ? <img src={offer.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon name="watch" size={34} />}
      </div>
      <div className="offer__body">
        <div className="offer__top">
          <ScoreBadge score={offer.score} />
          <span className="offer__variant">
            {showModel && <b>{spec.shortName}</b>}
            {variantLabel(offer.variant) && <span>{variantLabel(offer.variant)}</span>}
          </span>
        </div>
        <h3 className="offer__title">{offer.title}</h3>
        <div className="offer__store">
          <span className="store">{offer.store}</span>
          {offer.marketplace && <span className="tag tag--warn">Marketplace{offer.seller ? `: ${offer.seller}` : ''}</span>}
          {offer.condition !== 'novo' && <span className="tag tag--info">{CONDITION[offer.condition]}</span>}
          {belowTarget && <span className="tag tag--ok">Abaixo do seu alvo</span>}
        </div>

        <div className="offer__price">
          <span className="price">{brl(offer.price)}</span>
          {offer.priceCard && <span className="price__note">à vista</span>}
          {offer.listPrice && <s className="price__list">{brl0(offer.listPrice)}</s>}
        </div>
        {(offer.priceCard || offer.installments) && (
          <p className="price__card">
            {offer.priceCard ? `${brl(offer.priceCard)} no cartão` : ''}
            {offer.installments ? `${offer.priceCard ? ' · ' : ''}${offer.installments.n}x de ${brl(offer.installments.value)}` : ''}
          </p>
        )}
        {reason && <p className="offer__reason">{reason}</p>}
        {offer.score.inflatedListPrice && <p className="offer__warn">Preço "de" parece inflado — compare pelo histórico.</p>}

        {offer.coupon && (offer.coupon.code || offer.coupon.description) && (
          <div className="inline-coupon">
            <Icon name="ticket" size={16} />
            {offer.coupon.code ? (
              <>
                <span>Cupom</span>
                <code>{offer.coupon.code}</code>
                <CopyButton text={offer.coupon.code} label="Copiar" />
              </>
            ) : (
              <span>{offer.coupon.description}</span>
            )}
          </div>
        )}

        {stale && <p className="offer__warn">Publicada {ago(offer.postedAt, now)} — confira se ainda vale.</p>}

        <div className="offer__meta">
          {offer.community?.temperature !== undefined && (
            <span className="meta meta--hot"><Icon name="fire" size={13} />{offer.community.temperature}°</span>
          )}
          {offer.community?.likes !== undefined && offer.community.likes > 0 && <span className="meta">{offer.community.likes} curtidas</span>}
          {ends && <span className="meta meta--ends">{ends}</span>}
          <span className="meta">
            via {SOURCE_NAMES[offer.source]}
            {offer.alsoOn?.length ? ` + ${offer.alsoOn.map((a) => SOURCE_NAMES[a.source]).join(', ')}` : ''}
          </span>
          <span className="meta">{offer.postedAt ? `publicada ${ago(offer.postedAt, now)}` : `visto ${ago(offer.lastSeen, now)}`}</span>
        </div>

        <div className="offer__actions">
          <a className="btn btn--primary" href={offer.url} target="_blank" rel="noopener noreferrer">
            Ir para a loja <Icon name="external" size={15} />
          </a>
          {offer.discussionUrl && offer.discussionUrl !== offer.url && (
            <a className="btn btn--ghost" href={offer.discussionUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={15} /> Comentários
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function ModelCard({ summary, best, version }: { summary: ModelSummary; best?: Offer; version?: string }) {
  const spec = getModel(summary.model);
  const history = useHistory(summary.model, version);
  const variant = best?.variant ?? summary.variants.find((v) => v.current)?.variant;
  const stats = summary.variants.find((v) => v.variant === variant);
  const series = (variant && history?.variants[variant]) || [];
  const last30 = series.slice(-30).map((p) => p.p);
  const delta = stats?.median30 && best ? (best.price - stats.median30) / stats.median30 : undefined;

  return (
    <a className="mcard" href={`#/modelo/${summary.model}`} style={{ '--accent': spec.color } as CSSProperties}>
      <div className="mcard__head">
        <span className="mcard__name">{spec.shortName}</span>
        <span className="mcard__count">{summary.offersCount} ofertas</span>
      </div>
      {best ? (
        <>
          <div className="mcard__price">{brl(best.price)}</div>
          <div className="mcard__where">
            {best.store} · {variantLabel(best.variant).replace('Bluetooth', 'BT') || 'BT'}
          </div>
          <div className="mcard__foot">
            <ScoreBadge score={best.score} />
            <Sparkline values={last30} label={`Menor preço diário, últimos ${last30.length} dias`} />
          </div>
          {delta !== undefined && (
            <div className={`mcard__delta ${delta < -0.005 ? 'is-down' : delta > 0.005 ? 'is-up' : ''}`}>
              {pct(delta)} vs. mediana de 30 dias
            </div>
          )}
        </>
      ) : (
        <div className="mcard__none">Sem oferta de produto novo agora. Toque para ver o histórico.</div>
      )}
    </a>
  );
}

const SCOPE_LABEL: Record<Coupon['scope'], string> = {
  modelo: 'Para o relógio',
  smartwatch: 'Smartwatches',
  loja: 'Site todo',
};

export function CouponCard({ coupon, now }: { coupon: Coupon; now: number }) {
  return (
    <article className="coupon">
      <div className="coupon__stub">
        <span className="coupon__discount">{coupon.discount ?? 'Cupom'}</span>
        <span className="coupon__store">{coupon.store}</span>
      </div>
      <div className="coupon__body">
        <p className="coupon__title">{coupon.title}</p>
        {coupon.code && (
          <div className="coupon__code">
            <code>{coupon.code}</code>
            <CopyButton text={coupon.code} label="Copiar" />
          </div>
        )}
        <div className="coupon__meta">
          <span className={`tag tag--scope-${coupon.scope}`}>{SCOPE_LABEL[coupon.scope]}</span>
          {coupon.verified && <span className="tag tag--ok">Verificado</span>}
          {coupon.publishedAt && <span>publicado {ago(coupon.publishedAt, now)}</span>}
          {coupon.validUntil && <span>válido até {new Date(coupon.validUntil).toLocaleDateString('pt-BR')}</span>}
          {coupon.url && (
            <a href={coupon.url} target="_blank" rel="noopener noreferrer">
              detalhes <Icon name="external" size={12} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
