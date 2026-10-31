import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { HistoryPoint } from '../../../src/core/types.ts';
import { brl, brl0, dateBR } from '../data.ts';

const ORIGIN: Record<HistoryPoint['o'], string> = {
  coleta: 'Coleta WatchDeal',
  zoom: 'Histórico Zoom',
  pelando: 'Oferta no Pelando',
  promobit: 'Oferta no Promobit',
};

const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T12:00:00Z`);

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(1, max - min);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-6; v += step) ticks.push(Math.round(v));
  return ticks;
}

interface Props {
  points: HistoryPoint[];
  /** Mediana de 30 dias — linha de referência. */
  median30?: number;
  /** Preço-alvo do usuário — linha de referência. */
  target?: number;
  label: string;
  height?: number;
}

export function PriceChart({ points, median30, target, label, height = 220 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 54, r: 14, t: 18, b: 26 };
  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const t0 = toTime(points[0].d);
    const t1 = Math.max(toTime(points[points.length - 1].d), t0 + DAY);
    const values = points.map((p) => p.p);
    const refs = [median30, target].filter((v): v is number => v !== undefined);
    let lo = Math.min(...values, ...refs);
    let hi = Math.max(...values, ...refs);
    const margin = Math.max((hi - lo) * 0.12, hi * 0.02);
    lo -= margin;
    hi += margin;
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const x = (d: string) => pad.l + ((toTime(d) - t0) / (t1 - t0)) * innerW;
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * innerH;

    let path = '';
    points.forEach((p, i) => {
      const gap = i > 0 && toTime(p.d) - toTime(points[i - 1].d) > 10 * DAY;
      path += `${i === 0 || gap ? 'M' : 'L'}${x(p.d).toFixed(1)},${y(p.p).toFixed(1)}`;
    });
    let minIdx = 0;
    values.forEach((v, i) => {
      if (v < values[minIdx]) minIdx = i;
    });
    const xTicks: string[] = [];
    const n = Math.min(4, points.length);
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / Math.max(1, n - 1);
      xTicks.push(new Date(t).toISOString().slice(0, 10));
    }
    return { x, y, path, minIdx, yTicks: niceTicks(lo, hi), xTicks, innerW };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, median30, target, width, height]);

  if (!geo) return <div className="chart chart--empty">Sem histórico ainda para esta variante.</div>;

  const pick = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(geo.x(p.d) - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(best);
  };
  const onMove = (e: PointerEvent) => pick(e.clientX);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const minP = points[geo.minIdx];
  const last = points[points.length - 1];
  const act = active !== null ? points[active] : null;
  const tipLeft = act ? Math.min(Math.max(geo.x(act.d) - 80, 4), width - 164) : 0;
  const minLabelAbove = geo.y(minP.p) > pad.t + 40;

  return (
    <div className="chart" ref={wrap}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}: menor preço ${brl(minP.p)} em ${dateBR(minP.d)}; último ${brl(last.p)} em ${dateBR(last.d)}`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        style={{ touchAction: 'pan-y' }}
      >
        {geo.yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={geo.y(t)} y2={geo.y(t)} className="chart__grid" />
            <text x={pad.l - 8} y={geo.y(t)} className="chart__axis" textAnchor="end" dominantBaseline="middle">
              {brl0(t)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((d, i) => (
          <text
            key={d + i}
            x={geo.x(d)}
            y={height - 8}
            className="chart__axis"
            textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
          >
            {dateBR(d).slice(0, 5)}
          </text>
        ))}
        {median30 !== undefined && (
          <g>
            <line x1={pad.l} x2={width - pad.r} y1={geo.y(median30)} y2={geo.y(median30)} className="chart__ref" />
            <text x={width - pad.r} y={geo.y(median30) - 5} className="chart__reflabel" textAnchor="end">
              mediana 30d {brl0(median30)}
            </text>
          </g>
        )}
        {target !== undefined && (
          <g>
            <line x1={pad.l} x2={width - pad.r} y1={geo.y(target)} y2={geo.y(target)} className="chart__target" />
            <text x={pad.l + 4} y={geo.y(target) - 5} className="chart__reflabel chart__reflabel--target">
              seu alvo {brl0(target)}
            </text>
          </g>
        )}
        <path d={geo.path} className="chart__line" />
        <circle cx={geo.x(minP.d)} cy={geo.y(minP.p)} r={4.5} className="chart__dot chart__dot--min" />
        <text
          x={Math.min(Math.max(geo.x(minP.d), pad.l + 40), width - pad.r - 40)}
          y={geo.y(minP.p) + (minLabelAbove ? -10 : 18)}
          className="chart__minlabel"
          textAnchor="middle"
        >
          mín. {brl0(minP.p)}
        </text>
        <circle cx={geo.x(last.d)} cy={geo.y(last.p)} r={4} className="chart__dot" />
        {act && (
          <g>
            <line x1={geo.x(act.d)} x2={geo.x(act.d)} y1={pad.t} y2={height - pad.b} className="chart__cross" />
            <circle cx={geo.x(act.d)} cy={geo.y(act.p)} r={5.5} className="chart__dot chart__dot--active" />
          </g>
        )}
      </svg>
      {act && (
        <div className="chart__tip" style={{ left: tipLeft }} role="status">
          <span className="chart__tipdate">{dateBR(act.d)}</span>
          <b>{brl(act.p)}</b>
          <span>{act.s}</span>
          <small>{ORIGIN[act.o]}</small>
        </div>
      )}
      <details className="chart__table">
        <summary>Ver como tabela ({points.length} dias)</summary>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Menor preço</th>
              <th>Loja</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.d}>
                <td>{dateBR(p.d)}</td>
                <td>{brl(p.p)}</td>
                <td>{p.s}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <span className="spark spark--empty" aria-hidden />;
  const w = 96;
  const h = 30;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (w - 6), 3 + (1 - (v - lo) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path d={d} />
      <circle cx={lx} cy={ly} r={3} />
    </svg>
  );
}
