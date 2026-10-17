import { beamContact, RELAY_RADIUS, type Beam, type BeamTarget } from "./combat";

export type RelayReceiver = BeamTarget & { id: number; ax: number; ay: number; az: number };
export type RelaySegment = { beam: Beam; stage: "incoming" | "outgoing"; relayId: number | null };
export type RelayTrace<T extends BeamTarget = BeamTarget> = {
  sourceId: number;
  /** First receiver actually reached; an upstream enemy can leave this null. */
  relayId: number | null;
  segments: RelaySegment[];
  target: T | null;
  stop: "range" | "enemy" | "relay";
  /** A second receiver terminates the line; it never creates a chain. */
  blockedRelayId: number | null;
};

/**
 * One fixed redirection with the same center-ordered finite-cylinder test as
 * Sweep/Pin. Enemies win exact distance ties; receiver ties use ascending id.
 * The source's budget starts at its ordinary 0.7m-offset muzzle. Travel to the
 * receiver center consumes range, as does its 0.7m output muzzle offset. The
 * existing 0.4m contact gap is retained on both segments, not added as free reach.
 * Ordinary drones and decoration are not obstructions. No dynamic targeting,
 * split energy, loops, second turns, or duplicate damage targets are possible.
 */
export function traceRelay<T extends BeamTarget>(
  sourceId: number,
  incoming: Beam,
  receivers: readonly RelayReceiver[],
  enemies: readonly T[] = [],
): RelayTrace<T> {
  const result: RelayTrace<T> = {
    sourceId,
    relayId: null,
    segments: [],
    target: null,
    stop: "range",
    blockedRelayId: null,
  };
  const sortedReceivers = [...receivers].sort((a, b) => a.id - b.id);
  const closest = (beam: Beam, omitId: number | null) => {
    let distance = Infinity;
    let enemy: T | null = null;
    let receiver: RelayReceiver | null = null;
    for (const e of enemies) {
      const t = beamContact(beam, e);
      if (t !== null && t < distance) {
        distance = t;
        enemy = e;
        receiver = null;
      }
    }
    for (const r of sortedReceivers) {
      if (r.id === omitId) continue;
      const t = beamContact(beam, { ...r, radius: RELAY_RADIUS });
      if (t !== null && t < distance) {
        distance = t;
        receiver = r;
        enemy = null;
      }
    }
    return { distance, enemy, receiver };
  };
  const first = closest(incoming, null);
  result.segments.push({
    beam: { ...incoming, range: Math.min(incoming.range, first.distance) },
    stage: "incoming",
    relayId: first.receiver?.id ?? null,
  });
  if (first.enemy) {
    result.target = first.enemy;
    result.stop = "enemy";
    return result;
  }
  if (!first.receiver) return result;
  const receiver = first.receiver;
  result.relayId = receiver.id;
  const remaining = incoming.range - first.distance - 0.7;
  if (remaining < 0.4) {
    result.stop = "relay";
    result.blockedRelayId = receiver.id;
    return result;
  }
  const outgoing: Beam = {
    ...incoming,
    x: receiver.x + receiver.ax * 0.7,
    y: receiver.y + receiver.ay * 0.7,
    z: receiver.z + receiver.az * 0.7,
    dx: receiver.ax,
    dy: receiver.ay,
    dz: receiver.az,
    range: remaining,
  };
  const second = closest(outgoing, receiver.id);
  result.segments.push({
    beam: { ...outgoing, range: Math.min(outgoing.range, second.distance) },
    stage: "outgoing",
    relayId: receiver.id,
  });
  if (second.enemy) {
    result.target = second.enemy;
    result.stop = "enemy";
  } else if (second.receiver) {
    result.stop = "relay";
    result.blockedRelayId = second.receiver.id;
  }
  return result;
}
