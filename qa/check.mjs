// Browser regression checks for Helix Hold 0.6.0. Prepared but NOT EXECUTED during
// the 2026-10-12 managed-container turn: that environment cannot run browser QA.
// Run these later in an environment where browser testing is permitted:
//   npm run build && npm run preview      (leave running; default http://127.0.0.1:4173)
//   npm run qa                            (or BASE_URL=... npm run qa)
// Set CHROMIUM_PATH if Chromium is already installed outside Playwright's cache.
//
// Visibility regression: dynamic InstancedMesh populations must remain drawn
// when the origin is off-screen. Park on Orbital Garden's outer ring facing an
// armored barge with the core BEHIND the camera, then inspect its gold fittings.
import { mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import { chromium } from "playwright";

if (process.env.SITES_MANAGED_LINUX_CONTAINER === "1") {
  throw new Error("Browser QA is not permitted in this managed Sites container; run npm test for simulation checks.");
}
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4173";
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${msg}`);
  if (!ok) failures += 1;
};
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() =>
  localStorage.setItem("helix-hold-v1", JSON.stringify({ version: 1, unlocked: 3, bestCore: [90, 95, 83] })),
);
const start = () => page.getByRole("button", { name: "Enter the spiral", exact: true }).click();
const snap = () => page.evaluate(() => window.__helixDebug.snap());

try {
  await page.goto(`${BASE}/?qa`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__helixDebug);

  console.log("Arena identities and pacing defaults");
  check(await page.getByRole("button", { name: /^Flight School/ }).count() === 1, "Flight School replaces the two introductory arenas");
  check(await page.getByRole("button", { name: /^Archived study · Orbital Garden/ }).count() === 1, "Orbital Garden remains accessible in the archive");
  check(await page.getByRole("button", { name: /^Shear Lane/ }).innerText().then((text) => text.includes("83%")), "legacy Shear score follows its identity to the second slot");
  check(await page.getByRole("button", { name: /^Flight School/ }).innerText().then((text) => !text.includes("90%") && !text.includes("95%")), "legacy Needle/Twin scores do not become Flight School records");
  check(await page.getByRole("button", { name: "Plan & launch", exact: true }).getAttribute("aria-pressed") === "true", "new sessions default to manual Plan & launch");

  console.log("Title keyboard navigation");
  await page.getByRole("button", { name: "Mute", exact: true }).focus();
  await page.keyboard.press("Tab");
  check(await page.evaluate(() => !!document.activeElement?.closest(".arena-option")), "Tab reaches arena cards from title utilities");
  check((await snap()).phase === "title", "title Tab does not enter Survey");

  console.log("Controls and placement HUD");
  await start();
  await page.waitForTimeout(800);
  check((await snap()).waveMode === "manual" && (await snap()).waveIndex === -1, "entering an arena keeps the first wave waiting");
  check(await page.getByRole("button", { name: /^Launch wave 1/ }).isVisible(), "manual setup presents an explicit launch button");
  const y0 = await page.evaluate(() => window.__controlsTest.getYaw());
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyA");
  check((await page.evaluate(() => window.__controlsTest.getYaw())) > y0, "A turns left (yaw increases)");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(900);
  check((await page.evaluate(() => window.__controlsTest.getSpeed())) > 3, "W thrusts forward");
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(200);
  check((await snap()).mode === "sweep", "2 selects Sweep in the simulation");
  check(await page.getByRole("button", { name: /^Sweep/ }).evaluate((el) => el.classList.contains("selected")), "Sweep selection is visible in the HUD");
  // A legal resting placement away from the launch cradle, before waves begin.
  await page.evaluate(() => window.__helixDebug.place(0, 18, 14, 0, 0));
  const beforeAnchor = await snap();
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(250);
  check((await snap()).drones === 1, "F anchors an early drone");
  check((await snap()).scrap === beforeAnchor.scrap - 20, "first drone costs 20 scrap");
  check(await page.getByRole("button", { name: /Recall last/ }).isEnabled(), "recall becomes available in the HUD");
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(250);
  check((await snap()).drones === 0 && (await snap()).scrap === beforeAnchor.scrap, "R recalls the drone with its full paid-price refund");
  check(await page.getByRole("button", { name: /Recall last/ }).isDisabled(), "recall disables after the last drone is removed");
  await page.keyboard.press("Digit1");
  await page.waitForTimeout(150);
  check((await snap()).mode === "pierce", "1 selects Pierce again");
  await page.waitForTimeout(12500);
  check((await snap()).waveIndex === -1 && (await snap()).alive === 0 && (await snap()).rest > 0, "manual setup remains open beyond the former 12-second countdown");

  console.log("Pause and help modal");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check((await snap()).phase === "pause", "Esc pauses");
  await page.getByRole("button", { name: "Flight guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "Flight guide" });
  await guide.waitFor({ state: "visible" });
  await page.keyboard.press("Tab");
  check(await guide.evaluate((el) => el.contains(document.activeElement)), "Tab stays within the help dialog");
  await page.keyboard.press("Escape");
  await guide.waitFor({ state: "hidden" });
  check((await snap()).phase === "pause", "Esc closes help without resuming unseen flight");
  await page.getByRole("button", { name: "Resume flight", exact: true }).focus();
  await page.keyboard.press("Tab");
  check(await page.getByRole("button", { name: "Flight guide", exact: true }).evaluate((el) => el === document.activeElement), "ordinary Pause allows native Tab navigation");

  console.log("Saved pacing and deliberate launch");
  await page.getByRole("button", { name: "Auto waves", exact: true }).click();
  check((await snap()).waveMode === "auto" && (await snap()).rest === 12, "enabling Auto from paused initial setup grants a full 12-second window");
  await page.waitForTimeout(300);
  check((await snap()).rest === 12 && (await snap()).phase === "pause", "changing pacing does not unpause or consume preparation time");
  await page.goto(`${BASE}/?qa`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__helixDebug);
  check(await page.getByRole("button", { name: "Auto waves", exact: true }).getAttribute("aria-pressed") === "true", "pacing preference survives a page reload");
  await start();
  await page.waitForTimeout(500);
  check((await snap()).waveMode === "auto" && (await snap()).rest < 12, "saved Auto preference reaches the simulation on launch");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Plan & launch", exact: true }).click();
  await page.getByRole("button", { name: "Resume flight", exact: true }).click();
  await page.waitForTimeout(200);
  const manualRest = (await snap()).rest;
  await page.waitForTimeout(300);
  check((await snap()).waveMode === "manual" && (await snap()).rest === manualRest, "switching back to manual freezes the setup countdown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  check((await snap()).waveIndex === 0 && (await snap()).rest === 0, "Enter explicitly launches the waiting wave");

  console.log("Enemies visible away from the core (Orbital Garden, wave 2)");
  await page.goto(`${BASE}/?qa`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__helixDebug);
  await page.getByRole("button", { name: /^Archived study · Orbital Garden/ }).click();
  await start();
  // Orbital Garden is arena index 2; its wave-2 barges use outer-orbit path 1.
  // Every manual wait requires this explicit launch (the scene has no timer).
  await page.evaluate(() => window.__helixDebug.next());
  let outer = [];
  for (let i = 0; i < 400 && outer.length < 2; i++) {
    // Explicitly launch each waiting wave; next() is a no-op during active waves.
    await page.evaluate(() => window.__helixDebug.next());
    outer = (await page.evaluate(() => window.__helixDebug.enemies())).filter((e) => e.path === 1 && e.kind === "barge");
    if (outer.length < 2) await page.waitForTimeout(250);
  }
  check(outer.length >= 2, `wave 2 barges spawned on the outer orbit (${outer.length})`);
  if (outer.length) {
    await page.evaluate(() => window.__helixDebug.pause(true));
    const e = (await page.evaluate(() => window.__helixDebug.enemies()))
      .filter((x) => x.path === 1 && x.kind === "barge")
      .sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0];
    const radius = Math.hypot(e.x, e.z);
    const sx = e.x - (e.x / radius) * 9, sy = e.y + 1.5, sz = e.z - (e.z / radius) * 9;
    const dx = e.x - sx, dy = e.y - sy, dz = e.z - sz;
    const length = Math.hypot(dx, dy, dz);
    // place() refreshes aim immediately; no unfrozen simulation step is needed.
    await page.evaluate(([x, y, z, yaw, pitch]) => window.__helixDebug.place(x, y, z, yaw, pitch), [
      sx, sy, sz, Math.atan2(-dx / length, -dz / length), Math.asin(dy / length),
    ]);
    await page.waitForTimeout(800);
    const shot = await page.screenshot({ path: `${OUT}outer-orbit.png` });
    const png = PNG.sync.read(shot);
    let gold = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
      // 0.3 barges use neutral armor with gold (#ffcf7e) accent fittings. Allow
      // tone-mapping variation while excluding coral, lavender and blue UI.
      if (r > 180 && g > 150 && b < 210 && r - g >= 3 && r - g < 55 && g - b > 30) gold++;
    }
    // Updated palette/threshold needs its first permitted browser run; retain the
    // screenshot so a pass is paired with a human check of the actual silhouette.
    check(gold > 250, `gold barge fittings drawn with the core behind the camera (${gold} warm-gold pixels)`);
  }

  console.log("Optional carrier test flight");
  await page.goto(`${BASE}/?qa`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__helixDebug);
  await page.locator('.lab-option').click();
  await page.getByRole("button", { name: "Enter test flight", exact: true }).click();
  await page.keyboard.press("Digit3");
  await page.waitForTimeout(150);
  check((await snap()).mode === "stasis", "3 selects Stasis in the optional encounter");
  check(await page.locator('.beam-description').textContent() === "6m radius · 12m across · 50% slower", "field rules are visible");
  await page.evaluate(() => window.__helixDebug.place(11.3,22.6,6.4,0,0));
  await page.waitForTimeout(200);
  check((await snap()).coverage > 0, "actual 3D crossing has previewed field coverage");
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(200);
  check((await snap()).drones === 1 && (await snap()).scrap === 40, "Stasis consumes one paid slot");
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  await page.getByRole('button', {name:'Test placed fields',exact:true}).click();
  await page.waitForFunction(()=>window.__helixDebug.snap().stasisTouched>0,{},{timeout:40000});
  check((await snap()).checking === true && (await snap()).waveIndex === -1 && (await snap()).scrap === 40, 'harmless field check registers real contact without starting a wave or changing scrap');
  await page.getByRole('button', {name:'End check · back to setup',exact:true}).click();
  await page.waitForTimeout(150);
  check((await snap()).checking === false && (await snap()).alive === 0, 'ending field check removes probes and restores setup');
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  await page.locator('.fleet-list button').first().focus();
  await page.keyboard.press('Tab');
  check((await snap()).phase === 'pause' && await page.locator('.survey-card').evaluate(el=>el.contains(document.activeElement)), 'Survey Tab navigates fleet controls without resuming');
  await page.locator('.fleet-list button').first().click();
  await page.getByRole('button', {name:'Reposition · free',exact:true}).click();
  await page.waitForTimeout(200);
  check((await snap()).repositionId !== null && (await snap()).phase === 'play', 'Survey starts a free selected move');
  check(await page.locator('.launch-wave').isDisabled(), 'launch waits for the move to finish');
  await page.evaluate(() => window.__helixDebug.place(10,22,6,0,0));
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(250);
  check((await snap()).drones === 1 && (await snap()).scrap === 40 && (await snap()).repositionId === null, 'reposition reuses the paid field');
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(200);
  check((await snap()).drones === 0 && (await snap()).scrap === 60, "field recall returns its paid price");
  await page.screenshot({ path: `${OUT}carrier-lab.png` });

  console.log("Split Crown forecast and controls");
  await page.keyboard.press("Escape");
  await page.getByRole("button", {name:"Back to the observatory", exact:true}).click();
  await page.getByRole("button", {name:/^Split Crown/}).click();
  await page.getByRole("button", {name:/Show eight-wave gate plan/}).click();
  check(await page.locator('.gate-plan li').count() === 8, "Crown advertises all eight authored waves before launch");
  check(await page.locator('.gate-plan li').last().innerText().then(t=>t.includes('Gate E')), "last wave forecast exposes E before play");
  await start();
  await page.waitForTimeout(250);
  check(await page.locator('.lane-intel .lane').count() === 5, "five gates remain identifiable in the live HUD");
  check(await page.locator('.lane-intel .lane').last().innerText().then(t=>t.includes('Opens wave 8')), "E is dormant and correctly scheduled");
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(150);
  check((await snap()).mode === 'stasis' && (await snap()).waveIndex === -1, "Crown permits Stasis while first wave waits");
  await page.keyboard.press('Tab');
  await page.getByRole('button', {name:/Show eight-wave gate plan/}).click();
  check(await page.locator('.survey-card .gate-plan li').count() === 8, "full gate plan is available in paused Survey");
  await page.screenshot({path:`${OUT}split-crown-survey.png`});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(250);
  await page.screenshot({path:`${OUT}split-crown-portrait.png`});

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed — screenshots in qa/out/` : "\nall browser checks pass — screenshots in qa/out/");
process.exit(failures ? 1 : 0);
