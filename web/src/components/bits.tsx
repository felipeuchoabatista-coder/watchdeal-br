import { useState, type ReactNode } from 'react';
import type { Score } from '../../../src/core/types.ts';
import { Icon } from './Icon.tsx';

const SCORE_CLASS: Record<Score['label'], string> = {
  'Imperdível': 'score--top',
  'Ótima': 'score--great',
  'Boa': 'score--good',
  'Na média': 'score--avg',
  'Cara': 'score--bad',
};

export function ScoreBadge({ score, large = false }: { score: Score; large?: boolean }) {
  return (
    <span className={`score ${SCORE_CLASS[score.label]}${large ? ' score--lg' : ''}`} title={`Índice de Oferta ${score.value}/100`}>
      {score.label === 'Imperdível' && <Icon name="fire" size={large ? 16 : 13} />}
      <b>{score.value}</b>
      <span>{score.label}</span>
    </span>
  );
}

export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button type="button" className={`chip${active ? ' chip--on' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
      {count !== undefined && <span className="chip__count">{count}</span>}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden />
    </label>
  );
}

/** Botão que copia texto e confirma visualmente. */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" className={`copy${done ? ' copy--done' : ''}`} onClick={copy} aria-label={`Copiar ${label ?? text}`}>
      <Icon name={done ? 'check' : 'copy'} size={15} />
      <span>{done ? 'Copiado!' : label ?? 'Copiar'}</span>
    </button>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}
