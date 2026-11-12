const KEY = "helix-hold-v2";
const LEGACY_KEY = "helix-hold-v1";
const ACTIVE_IDS = ["tutorial", "shear", "orbital", "split-crown"] as const;
/** Lean lab arenas keep a personal best in their own map, never in campaign scores. */
const LAB_IDS = ["lean-shear"] as const;
const LEGACY_LEVELS = [
  { id: "needle", name: "Glass Needle" },
  { id: "twin", name: "Twin Ribbon" },
  { id: "shear", name: "Shear Lane" },
] as const;

export type LegacyBest = { name: string; bestCore: number };
export type SaveData = {
  version: 2;
  bestByLevel: Record<string, number>;
  /** Archived v1 scores retain their original arena identity after reordering. */
  legacyBestByLevel: Record<string, LegacyBest>;
  /** Best core kept in optional lean experiments; absent in older saves. */
  labBestByLevel: Record<string, number>;
};

export function freshSave(): SaveData {
  return {
    version: 2,
    bestByLevel: { tutorial: -1, shear: -1, orbital: -1, "split-crown": -1 },
    legacyBestByLevel: {},
    labBestByLevel: {},
  };
}

function score(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.min(100, Math.round(value)))
    : -1;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function persist(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* Keep the in-memory result when browser storage is unavailable. */
  }
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  const current = read(KEY);
  if (object(current) && current.version === 2 && object(current.bestByLevel)) {
    const save = freshSave();
    for (const id of ACTIVE_IDS) save.bestByLevel[id] = score(current.bestByLevel[id]);
    if (object(current.labBestByLevel)) {
      for (const id of LAB_IDS) {
        const best = score(current.labBestByLevel[id]);
        if (best >= 0) save.labBestByLevel[id] = best;
      }
    }
    if (object(current.legacyBestByLevel)) {
      for (const level of LEGACY_LEVELS) {
        const old = current.legacyBestByLevel[level.id];
        if (object(old)) {
          save.legacyBestByLevel[level.id] = { name: level.name, bestCore: score(old.bestCore) };
        }
      }
    }
    return save;
  }

  const legacy = read(LEGACY_KEY);
  const save = freshSave();
  if (object(legacy) && legacy.version === 1 && Array.isArray(legacy.bestCore)) {
    const oldScores = legacy.bestCore;
    LEGACY_LEVELS.forEach((level, index) => {
      const bestCore = score(oldScores[index]);
      save.legacyBestByLevel[level.id] = { name: level.name, bestCore };
      // Shear retains its identity when moving from slot 2 to slot 1.
      if (level.id === "shear") save.bestByLevel.shear = bestCore;
    });
    // The v1 key is deliberately retained. Needle/Twin do not become Flight School wins.
    persist(save);
  }
  return save;
}

export function recordWin(levelId: string, core: number): SaveData {
  const save = loadSave();
  if (!ACTIVE_IDS.some((id) => id === levelId)) return save;
  save.bestByLevel[levelId] = Math.max(save.bestByLevel[levelId] ?? -1, score(core));
  persist(save);
  return save;
}

/** Optional lean arenas: campaign entries are read back unchanged. */
export function recordLabResult(levelId: string, core: number): SaveData {
  const save = loadSave();
  if (!LAB_IDS.some((id) => id === levelId)) return save;
  save.labBestByLevel[levelId] = Math.max(save.labBestByLevel[levelId] ?? -1, score(core));
  persist(save);
  return save;
}
