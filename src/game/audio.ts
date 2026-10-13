export type AudioBus = {
  resume: () => void;
  setMuted: (on: boolean) => void;
  dispose: () => void;
  setEngine: (amount: number, active: boolean) => void;
  hit: () => void;
  kill: () => void;
  anchor: () => void;
  leak: () => void;
  acquire: () => void;
};

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let engineGain: GainNode | null = null;
  let osc: OscillatorNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let lastBlip = 0;
  let muted = false;

  function resume() {
    if (!ctx) {
      const AC = window.AudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.2;
      master.connect(ctx.destination);
      osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 48;
      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 240;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      osc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      osc.start();
    }
    if (ctx.state === "suspended") void ctx.resume();
  }

  function blip(freq: number, dur: number, type: OscillatorType, gain: number) {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    if (now - lastBlip < 0.03 && type !== "triangle") return;
    lastBlip = now;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), now + dur);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  return {
    resume,
    setMuted(on) { muted = on; if (master && ctx) master.gain.setTargetAtTime(on ? 0 : 0.2, ctx.currentTime, 0.04); },
    dispose() { if (ctx) void ctx.close(); ctx = null; master = null; },
    setEngine(amount, active) {
      if (!ctx || !engineGain || !osc || !filter) return;
      const now = ctx.currentTime;
      const target = active ? 0.018 + amount * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, now, 0.08);
      osc.frequency.setTargetAtTime(42 + amount * 70, now, 0.08);
      filter.frequency.setTargetAtTime(180 + amount * 420, now, 0.1);
    },
    hit() {
      blip(520, 0.05, "square", 0.03);
    },
    kill() {
      blip(240, 0.12, "triangle", 0.06);
    },
    anchor() {
      blip(140, 0.22, "sawtooth", 0.07);
      blip(320, 0.16, "triangle", 0.05);
    },
    leak() {
      blip(70, 0.28, "sine", 0.09);
    },
    acquire() {
      blip(880, 0.06, "sine", 0.035);
    },
  };
}
