export default async function run(page, ui) {
  const results = { steps: [] };

  // Frame-time sampler installed once.
  await page.evaluate(() => {
    window.__ft = { times: [], last: 0 };
    const loop = (t) => {
      if (window.__ft.last) window.__ft.times.push(t - window.__ft.last);
      window.__ft.last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  const stats = () =>
    page.evaluate(() => {
      const a = window.__ft.times;
      window.__ft.times = [];
      window.__ft.last = 0;
      if (!a.length) return { n: 0 };
      const s = [...a].sort((x, y) => x - y);
      const sum = a.reduce((p, c) => p + c, 0);
      return {
        n: a.length,
        avgMs: +(sum / a.length).toFixed(2),
        p95: +s[Math.floor(s.length * 0.95)].toFixed(2),
        maxMs: +s[s.length - 1].toFixed(2),
        longFrames: a.filter((x) => x > 50).length,
      };
    });

  // Baseline on the idle start screen.
  await page.waitForTimeout(2500);
  results.steps.push({ at: "start-idle", ...(await stats()) });

  // Now type the driver name, character by character. Each keystroke rebuilds
  // demoConfig -> DemoBackground effect -> new GameEngine + RoadRenderer + backdrop.
  const nameBox = page.locator('input[placeholder="ACE"]');
  await nameBox.click();
  await nameBox.fill("");
  const before = await stats();
  results.steps.push({ at: "before-name-typing", ...before });

  for (const ch of "RACERX") {
    await nameBox.press(ch);
    await page.waitForTimeout(180);
  }
  results.steps.push({ at: "during-name-typing", ...(await stats()) });

  await page.waitForTimeout(1200);
  results.steps.push({ at: "after-name-typing", ...(await stats()) });

  // Count how many times the backdrop is rebuilt: instrument canvas creation.
  await page.evaluate(() => {
    window.__canvases = 0;
    const orig = document.createElement.bind(document);
    document.createElement = function (tag, ...rest) {
      if (String(tag).toLowerCase() === "canvas") window.__canvases++;
      return orig(tag, ...rest);
    };
  });
  await nameBox.press("Z");
  await page.waitForTimeout(1200);
  results.canvasesCreatedOnOneKeystroke = await page.evaluate(() => window.__canvases);

  return results;
}
