import { useState } from "react";
import type { LevelDef, WaveSpec } from "./paths";

const names = { shard: "Shards", barge: "Barges", wisp: "Wisps", carrier: "Carrier" };

function WaveRows({ waves, offset = 0, wave }: { waves: WaveSpec[]; offset?: number; wave?: number }) {
  return (
    <ol start={offset + 1}>
      {waves.map((w, i) => {
        const gates = [...new Set(w.groups.map((g) => g.path))].sort((a, b) => a - b);
        const kinds = [...new Set(w.groups.map((g) => g.kind))];
        const number = offset + i + 1;
        return (
          <li key={number} aria-current={wave === number ? "step" : undefined}>
            <b>{String(number).padStart(2, "0")}</b>
            <div>
              <strong>{w.chapter?.replace(/^\d+\s*[·—-]\s*/, "") ?? `Wave ${number}`}</strong>
              <span>
                {gates
                  .map(
                    (g) =>
                      `Gate ${String.fromCharCode(65 + g)} · ${Math.min(...w.groups.filter((s) => s.path === g).map((s) => s.delay)).toFixed(1)}s`,
                  )
                  .join(" / ")}
              </span>
              <small>
                {kinds
                  .map(
                    (k) =>
                      `${w.groups.filter((g) => g.kind === k).reduce((n, g) => n + g.count, 0)} ${names[k]}`,
                  )
                  .join(" · ")}
              </small>
              {w.drift?.length ? (
                <em className="gate-plan-drift">
                  {w.drift
                    .map((d) => `Gate ${String.fromCharCode(65 + d.path)} swings ${Math.abs(d.degrees)}°`)
                    .join(" · ")}{" "}
                  before launch
                </em>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The schedule is authored game data, so forecasts cannot drift from spawns. */
export function GatePlan({
  level,
  waves = level.waves,
  wave,
}: {
  level: LevelDef;
  waves?: WaveSpec[];
  wave?: number;
}) {
  const [open, setOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const extras = waves.length === level.waves.length ? (level.continuation ?? []) : [];
  const allWaves = [...waves, ...extras];
  const carrierWaves = allWaves.flatMap((w, i) =>
    w.groups.some((g) => g.kind === "carrier") ? [i + 1] : [],
  );
  return (
    <div className="gate-plan">
      <button className="gate-plan-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          {open ? "Hide" : "Show"} {waves.length}-wave gate plan
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {extras.length > 0 && (
        <p className="gate-plan-option">
          Optional waves {waves.length + 1}–{allWaves.length} follow your recorded {level.waves.length}-wave
          victory.
        </p>
      )}
      {open && (
        <div className="gate-plan-body">
          <p>
            {level.driftPath ? (
              "Three coils open on waves 1, 3 and 6. From wave 4, an announced coil swings around the prism before launch; your drones stay put."
            ) : level.prototype === "route-expansion" ? (
              "Three coils open in stages: A on wave 1, B on wave 3, C on wave 6. Each has a separate breach port."
            ) : level.prototype === "relay" ? (
              "Four short trials compare the direct line, a redirected line, and traffic that can block the receiver."
            ) : (
              <>
                Gates open in stages. E carries the carrier in {carrierWaves.length === 1 ? "wave" : "waves"}{" "}
                {carrierWaves.join(" and ")}.
              </>
            )}{" "}
            Setup stays open until you launch in Plan & launch.
          </p>
          <WaveRows waves={waves} wave={wave} />
          {extras.length > 0 && (
            <div className="gate-plan-extra">
              <button
                className="gate-plan-toggle"
                aria-expanded={extraOpen}
                onClick={() => setExtraOpen(!extraOpen)}
              >
                <span>
                  {extraOpen ? "Hide" : "Show"} optional waves {waves.length + 1}–{allWaves.length}
                </span>
                <span aria-hidden="true">{extraOpen ? "−" : "+"}</span>
              </button>
              <p>
                Continue with your fleet, remaining core and scrap. The last carrier is stronger; continuing
                leaves your campaign record intact.
              </p>
              {extraOpen && <WaveRows waves={extras} offset={waves.length} wave={wave} />}
            </div>
          )}
          <p>
            Gate times are seconds after launch, not a countdown during setup.
            {level.presentation === "split-crown" && " A/B west · C/D east · E crown transfer."}
            {level.prototype && " Prototype results stay separate from campaign records."}
          </p>
        </div>
      )}
    </div>
  );
}
