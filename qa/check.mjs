// Browser regression checks for Helix Hold. Updated 2026-10-13; these revisions
// are prepared, NOT browser-executed in the managed Sites environment.
// Run these later in an environment where browser testing is permitted:
//   npm run build && npm run preview      (leave running; default http://127.0.0.1:4173)
//   npm run qa                            (or BASE_URL=... npm run qa)
// Set CHROMIUM_PATH if Chromium is already installed outside Playwright's cache.
//
// Visibility regression: dynamic InstancedMesh populations must remain drawn
// when the origin is off-screen. Park on Orbital Garden's outer ring facing an
// armored barge with the core BEHIND the camera, then inspect its gold fittings.
import { mkdirSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
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
page.setDefaultTimeout(30000);
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() =>
  localStorage.setItem("helix-hold-v1", JSON.stringify({ version: 1, unlocked: 3, bestCore: [90, 95, 83] })),
);
const start = () => page.getByRole("button", { name: "Enter the spiral", exact: true }).click();
const snap = () => page.evaluate(() => window.__helixDebug.snap());
// React HUD refresh and simulation steps can lag wall time on software renderers.
// Await the relevant state, then separately await the visible HUD when asserting it.
const waitState = (expected, target = page) => target.waitForFunction((expected) => {
  const state = window.__helixDebug?.snap();
  return state && Object.entries(expected).every(([key, value]) => state[key] === value);
}, expected);
const waitText = (selector, text, target = page) => target.waitForFunction(({ selector, text }) =>
  document.querySelector(selector)?.textContent === text, { selector, text });
const renderedFrames = (target = page, count = 2) => target.evaluate((count) => new Promise((resolve) => {
  const next = () => --count <= 0 ? resolve() : requestAnimationFrame(next);
  requestAnimationFrame(next);
}), count);
const checkCrownPortrait = async (target, label) => {
  await target.locator('.survey-card').waitFor({ state: 'visible' });
  await renderedFrames(target);
  const layout = await target.evaluate(() => {
    const survey = document.querySelector('.survey-card').getBoundingClientRect();
    const gates = [...document.querySelectorAll('.lane-intel .lane')].map(el => {
      const box = el.getBoundingClientRect();
      return { visible: box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
        overlaps: box.left < survey.right && box.right > survey.left && box.top < survey.bottom && box.bottom > survey.top };
    });
    const launch = document.querySelector('.launch-wave');
    const box = launch.getBoundingClientRect();
    // Inspect the actual launch-label text, not the button height or its kbd chip.
    const label = launch.querySelector('.launch-label') ?? launch;
    const textRects = [...label.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()).flatMap(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return [...range.getClientRects()].map(r => ({ top: r.top, bottom: r.bottom }));
    });
    return { gates, labelLines: new Set(textRects.map(r => Math.round(r.top))).size,
      launchFits: box.left >= 0 && box.right <= innerWidth && launch.scrollWidth <= launch.clientWidth + 1 };
  });
  check(layout.gates.length === 5 && layout.gates.every(g => g.visible && !g.overlaps), `${label}: all five gate cards fit above Survey without overlap`);
  check(layout.labelLines === 1 && layout.launchFits, `${label}: launch label stays on one line within the viewport`);
};

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
  await waitState({ phase: "play", waveIndex: -1 });
  await page.getByRole("button", { name: /^Launch wave 1/ }).waitFor({ state: "visible" });
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
  await waitState({ mode: "sweep" });
  await page.waitForFunction(() => [...document.querySelectorAll(".mode-buttons button")].some(el => el.textContent.includes("Sweep") && el.classList.contains("selected")));
  check((await snap()).mode === "sweep", "2 selects Sweep in the simulation");
  check(await page.getByRole("button", { name: /^Sweep/ }).evaluate((el) => el.classList.contains("selected")), "Sweep selection is visible in the HUD");
  // A legal resting placement away from the launch cradle, before waves begin.
  await page.evaluate(() => window.__helixDebug.place(0, 18, 14, 0, 0));
  const beforeAnchor = await snap();
  await page.keyboard.press("KeyF");
  await waitState({ drones: 1 });
  await page.waitForFunction(() => document.querySelector(".recall")?.disabled === false);
  check((await snap()).drones === 1, "F anchors an early drone");
  check((await snap()).scrap === beforeAnchor.scrap - 20, "first drone costs 20 scrap");
  check(await page.getByRole("button", { name: /Recall last/ }).isEnabled(), "recall becomes available in the HUD");
  await page.keyboard.press("KeyR");
  await waitState({ drones: 0, scrap: beforeAnchor.scrap });
  await page.waitForFunction(() => document.querySelector(".recall")?.disabled === true);
  check((await snap()).drones === 0 && (await snap()).scrap === beforeAnchor.scrap, "R recalls the drone with its full paid-price refund");
  check(await page.getByRole("button", { name: /Recall last/ }).isDisabled(), "recall disables after the last drone is removed");
  await page.keyboard.press("Digit1");
  await waitState({ mode: "pierce" });
  check((await snap()).mode === "pierce", "1 selects Pierce again");
  await page.waitForTimeout(12500);
  check((await snap()).waveIndex === -1 && (await snap()).alive === 0 && (await snap()).rest > 0, "manual setup remains open beyond the former 12-second countdown");

  console.log("Pause and help modal");
  await page.keyboard.press("Escape");
  await waitState({ phase: "pause" });
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
  await page.waitForFunction(() => { const s = window.__helixDebug.snap(); return s.phase === "play" && s.waveMode === "auto" && s.rest < 12; });
  check((await snap()).waveMode === "auto" && (await snap()).rest < 12, "saved Auto preference reaches the simulation on launch");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Plan & launch", exact: true }).click();
  await page.getByRole("button", { name: "Resume flight", exact: true }).click();
  await waitState({ phase: "play", waveMode: "manual" });
  const manualRest = (await snap()).rest;
  await page.waitForTimeout(300);
  check((await snap()).waveMode === "manual" && (await snap()).rest === manualRest, "switching back to manual freezes the setup countdown");
  await page.keyboard.press("Enter");
  await waitState({ waveIndex: 0, rest: 0 });
  check((await snap()).waveIndex === 0 && (await snap()).rest === 0, "Enter explicitly launches the waiting wave");

  console.log("Enemies visible away from the core (Orbital Garden, wave 2)");
  await page.goto(`${BASE}/?qa`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__helixDebug);
  await page.getByRole("button", { name: /^Archived study · Orbital Garden/ }).click();
  await start();
  // Orbital Garden is arena index 2; its wave-2 barges use outer-orbit path 1.
  // Every manual wait requires this explicit launch (the scene has no timer).
  await page.evaluate(() => window.__helixDebug.next());
  // This is intentionally a simulation condition, not a frame-count budget.
  // At 5 fps the fixed-step cap makes these waves take minutes of wall time.
  await page.waitForFunction(() => {
    window.__helixDebug.next();
    return window.__helixDebug.enemies().filter(e => e.path === 1 && e.kind === "barge").length >= 2;
  }, null, { timeout: 360000, polling: 100 });
  const outer = (await page.evaluate(() => window.__helixDebug.enemies())).filter(e => e.path === 1 && e.kind === "barge");
  check(outer.length >= 2, `wave 2 barges spawned on the outer orbit (${outer.length})`);
  if (outer.length) {
    await page.evaluate(() => window.__helixDebug.pause(true));
    const e = (await page.evaluate(() => window.__helixDebug.enemies()))
      .filter((x) => x.path === 1 && x.kind === "barge")
      .sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0];
    const radius = Math.hypot(e.x, e.z);
    // Move the target above the pilot silhouette: stand 3 m inside its radius
    // and 4 m below, looking outward and slightly past it on a level heading.
    const sx = e.x - (e.x / radius) * 3, sy = e.y - 4, sz = e.z - (e.z / radius) * 3;
    const yaw = Math.atan2(-e.x / radius, -e.z / radius) + 0.28, pitch = 0;
    const aim = new Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const ship = new Vector3(sx, sy, sz);
    // Match the stationary follow-camera geometry in scene.ts. These assertions
    // concern the intended framing only; they do not prove raster visibility.
    const camera = new PerspectiveCamera(60, 1280 / 800, 0.1, 600);
    camera.position.copy(ship).addScaledVector(aim, -10.8).add(new Vector3(0, 2.65, 0));
    camera.lookAt(ship.clone().addScaledVector(aim, 8).add(new Vector3(0, 0.45, 0)));
    camera.updateMatrixWorld();
    const coreCamera = new Vector3(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    const target = new Vector3(e.x, e.y, e.z).project(camera), pilot = ship.clone().project(camera);
    check(coreCamera.z > 0 && Math.abs(target.x) < 0.8 && Math.abs(target.y) < 0.8 && target.z > -1 && target.z < 1,
      "barge evidence pose frames the target with the core behind the camera");
    check(Math.hypot((target.x - pilot.x) * 640, (target.y - pilot.y) * 400) > 55,
      "barge evidence pose separates target and pilot centers by more than 55 px");
    // A prior far-away pose guarantees the real camera snaps to the final pose
    // rather than depending on an arbitrary interpolation wait at low fps.
    await page.evaluate(([x, y, z]) => window.__helixDebug.place(x + 100, y, z, 0, 0), [sx, sy, sz]);
    await renderedFrames();
    await page.evaluate(args => window.__helixDebug.place(...args), [sx, sy, sz, yaw, pitch]);
    await renderedFrames();
    const shot = await page.screenshot({ path: `${OUT}outer-orbit.png` });
    const png = PNG.sync.read(shot), scaleX = png.width / 1280, scaleY = png.height / 800;
    const targetX = (target.x * 0.5 + 0.5) * 1280, targetY = (-target.y * 0.5 + 0.5) * 800;
    let gold = 0;
    for (let y = Math.max(0, Math.floor((targetY - 60) * scaleY)); y < Math.min(png.height, (targetY + 60) * scaleY); y++) {
      for (let x = Math.max(0, Math.floor((targetX - 60) * scaleX)); x < Math.min(png.width, (targetX + 60) * scaleX); x++) {
        const i = (y * png.width + x) * 4, [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
        if (r > 180 && g > 150 && b < 210 && r - g >= 3 && r - g < 55 && g - b > 30) gold++;
      }
    }
    console.log(`  Evidence only: ${gold} warm-gold pixels in the target crop; inspect outer-orbit.png for the barge silhouette.`);
    // The old whole-screen >250 threshold was uncalibrated and sensitive to
    // pilot occlusion. A color count alone is not a visibility/accessibility test.
  }

  console.log("Optional carrier test flight");
  await page.goto(`${BASE}/?qa`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__helixDebug);
  await page.locator('.lab-option').click();
  await page.getByRole("button", { name: "Enter test flight", exact: true }).click();
  await page.keyboard.press("Digit3");
  await waitState({ mode: "stasis" });
  await waitText(".beam-description", "6m radius · 12m across · 50% slower");
  check((await snap()).mode === "stasis", "3 selects Stasis in the optional encounter");
  check(await page.locator('.beam-description').textContent() === "6m radius · 12m across · 50% slower", "field rules are visible");
  await page.evaluate(() => window.__helixDebug.place(11.3,22.6,6.4,0,0));
  await page.waitForFunction(() => window.__helixDebug.snap().coverage > 0);
  check((await snap()).coverage > 0, "actual 3D crossing has previewed field coverage");
  await page.keyboard.press("KeyF");
  await waitState({ drones: 1, scrap: 40 });
  check((await snap()).drones === 1 && (await snap()).scrap === 40, "Stasis consumes one paid slot");
  await page.keyboard.press('Tab');
  await waitState({ phase: 'pause' });
  await page.getByRole('button', {name:'Test placed fields',exact:true}).click();
  await waitState({ checking: true, phase: 'play' });
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector('canvas'));
  check(await page.evaluate(() => document.pointerLockElement === document.querySelector('canvas')), 'desktop field check captures the pointer');
  await page.waitForFunction(()=>window.__helixDebug.snap().stasisTouched>0,null,{timeout:180000});
  check((await snap()).checking === true && (await snap()).waveIndex === -1 && (await snap()).scrap === 40, 'harmless field check registers real contact without starting a wave or changing scrap');
  await page.locator('.launch-wave kbd').waitFor({ state: 'visible' });
  check(await page.locator('.launch-wave kbd').textContent() === 'Enter', 'field-check exit advertises its keyboard shortcut');
  await page.keyboard.press('Enter');
  await waitState({ checking: false, alive: 0, waveIndex: -1, phase: 'play' });
  check((await snap()).checking === false && (await snap()).alive === 0 && (await snap()).waveIndex === -1, 'Enter ends the pointer-locked field check without launching a wave');
  await page.keyboard.press("Tab");
  await waitState({ phase: 'pause' });
  await page.locator('.fleet-list button').first().focus();
  await page.keyboard.press('Tab');
  check((await snap()).phase === 'pause' && await page.locator('.survey-card').evaluate(el=>el.contains(document.activeElement)), 'Survey Tab navigates fleet controls without resuming');
  await page.locator('.fleet-list button').first().click();
  await page.getByRole('button', {name:'Reposition · free',exact:true}).click();
  await page.waitForFunction(() => { const s = window.__helixDebug.snap(); return s.repositionId !== null && s.phase === 'play'; });
  await page.waitForFunction(() => document.querySelector('.launch-wave')?.disabled === true);
  check((await snap()).repositionId !== null && (await snap()).phase === 'play', 'Survey starts a free selected move');
  check(await page.locator('.launch-wave').isDisabled(), 'launch waits for the move to finish');
  await page.evaluate(() => window.__helixDebug.place(10,22,6,0,0));
  await page.keyboard.press('KeyF');
  await waitState({ drones: 1, scrap: 40, repositionId: null });
  check((await snap()).drones === 1 && (await snap()).scrap === 40 && (await snap()).repositionId === null, 'reposition reuses the paid field');
  await page.keyboard.press("KeyR");
  await waitState({ drones: 0, scrap: 60 });
  check((await snap()).drones === 0 && (await snap()).scrap === 60, "field recall returns its paid price");
  await page.screenshot({ path: `${OUT}carrier-lab.png` });

  console.log("Split Crown forecast and controls");
  await page.keyboard.press("Escape");
  await page.getByRole("button", {name:"Back to the observatory", exact:true}).click();
  await page.getByRole("button", {name:/^Split Crown/}).click();
  await page.getByRole("button", {name:/Show eight-wave gate plan/}).click();
  await page.locator('.gate-plan li').nth(7).waitFor({ state: 'visible' });
  check(await page.locator('.gate-plan li').count() === 8, "Crown advertises all eight authored waves before launch");
  check(await page.locator('.gate-plan li').last().innerText().then(t=>t.includes('Gate E')), "last wave forecast exposes E before play");
  await start();
  await page.locator('.lane-intel .lane').nth(4).waitFor({ state: 'visible' });
  check(await page.locator('.lane-intel .lane').count() === 5, "five gates remain identifiable in the live HUD");
  check(await page.locator('.lane-intel .lane').last().innerText().then(t=>t.includes('Opens wave 8')), "E is dormant and correctly scheduled");
  await page.keyboard.press('Digit3');
  await waitState({ mode: 'stasis', waveIndex: -1 });
  check((await snap()).mode === 'stasis' && (await snap()).waveIndex === -1, "Crown permits Stasis while first wave waits");
  await page.keyboard.press('Tab');
  await page.getByRole('button', {name:/Show eight-wave gate plan/}).click();
  await page.locator('.survey-card .gate-plan li').nth(7).waitFor({ state: 'visible' });
  check(await page.locator('.survey-card .gate-plan li').count() === 8, "full gate plan is available in paused Survey");
  await page.screenshot({path:`${OUT}split-crown-survey.png`});
  await page.setViewportSize({width:390,height:844});
  await checkCrownPortrait(page, '390×844 desktop portrait');
  await page.screenshot({path:`${OUT}split-crown-portrait.png`});

  console.log('Split Crown touch-context portrait');
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const touchPage = await touchContext.newPage();
    touchPage.setDefaultTimeout(30000);
    touchPage.on('pageerror', e => errors.push(`touch: ${e.message}`));
    await touchPage.addInitScript(() => localStorage.setItem('helix-hold-v1', JSON.stringify({ version: 1, unlocked: 3, bestCore: [90, 95, 83] })));
    await touchPage.goto(`${BASE}/?qa`, { waitUntil: 'load' });
    await touchPage.waitForFunction(() => !!window.__helixDebug);
    await touchPage.getByRole('button', { name: /^Split Crown/ }).tap();
    await touchPage.getByRole('button', { name: 'Enter the spiral', exact: true }).tap();
    await waitState({ phase: 'play', waveIndex: -1 }, touchPage);
    await touchPage.waitForFunction(() => document.querySelector('.game-root')?.dataset.touch === '1');
    check(await touchPage.evaluate(() => matchMedia('(pointer: coarse)').matches && !document.pointerLockElement), 'touch context uses coarse-pointer controls without pointer lock');
    await touchPage.getByRole('button', { name: 'Survey arena', exact: true }).tap();
    await touchPage.getByRole('button', { name: /Show eight-wave gate plan/ }).tap();
    await touchPage.locator('.survey-card .gate-plan li').nth(7).waitFor({ state: 'visible' });
    await checkCrownPortrait(touchPage, '390×844 touch context');
    await touchPage.screenshot({ path: `${OUT}split-crown-touch-portrait.png` });
  } finally {
    await touchContext.close();
  }

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) failed — screenshots in qa/out/` : "\nall browser checks pass — screenshots in qa/out/");
process.exit(failures ? 1 : 0);
