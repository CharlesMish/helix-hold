import { useState } from 'react';
import type { LevelDef } from './paths';

const names = { shard: 'Shards', barge: 'Barges', wisp: 'Wisps', carrier: 'Carrier' };

/** The schedule is authored game data, so forecasts cannot drift from spawns. */
export function GatePlan({ level, wave }: { level: LevelDef; wave?: number }) {
  const [open, setOpen] = useState(false);
  return <div className="gate-plan">
    <button className="gate-plan-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{open ? 'Hide' : 'Show'} eight-wave gate plan</span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="gate-plan-body">
      <p>Gates open in stages. E is reserved for the final carrier. Setup stays open until you launch in Plan & launch.</p>
      <ol>{level.waves.map((w, i) => {
        const gates = [...new Set(w.groups.map(g => g.path))].sort((a, b) => a - b);
        const kinds = [...new Set(w.groups.map(g => g.kind))];
        return <li key={i} aria-current={wave === i + 1 ? 'step' : undefined}>
          <b>{String(i + 1).padStart(2, '0')}</b>
          <div><strong>{w.chapter?.replace(/^\d+\s*[·—-]\s*/, '') ?? `Wave ${i + 1}`}</strong>
            <span>{gates.map(g => `Gate ${String.fromCharCode(65 + g)} · ${Math.min(...w.groups.filter(s => s.path === g).map(s => s.delay)).toFixed(1)}s`).join(' / ')}</span>
            <small>{kinds.map(k => `${w.groups.filter(g => g.kind === k).reduce((n, g) => n + g.count, 0)} ${names[k]}`).join(' · ')}</small>
          </div>
        </li>;
      })}</ol>
      <p>Gate times are seconds after launch, not a countdown during setup. A/B west · C/D east · E crown transfer.</p>
    </div>}
  </div>;
}
