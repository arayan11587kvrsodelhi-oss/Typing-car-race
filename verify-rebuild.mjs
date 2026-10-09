export default async function run(page, ui) {
  const results = { steps: [] };

  // Instrument BEFORE the app loads is impossible post-hoc, so instead detect
  // backdrop rebuilds by watching the sky canvas allocation on the demo canvas.
  await page.evaluate(() => {
    // Count ResizeObserver observe() calls and canvas elements over time.
    window.__obs = 0;
    const RO = window.ResizeObserver;
    window.ResizeObserver = class extends RO {
      observe(...a) {
        window.__obs++;
        return super.observe(...a);
      }
    };
  });

  const nameBox = page.locator('input[placeholder="ACE"]');
  await nameBox.click();

  // Change the ENVIRONMENT (track) — the most asset-heavy rebuild path.
  const s = await ui.snapshot();
  const envRefs = s.match(/@(e\d+) radio "[^"]*"/g) || [];
  const alpine = s.match(/@(e\d+) radio "Alpine Dawn[^"]*"/)?.[1];

  const before = await page.evaluate(() => window.__obs);
  if (alpine) {
    await ui.click(alpine);
    await page.waitForTimeout(1500);
  }
  const afterEnv = await page.evaluate(() => window.__obs);
  results.steps.push({ at: "environment-change", observersBefore: before, observersAfter: afterEnv });

  // Now type 5 name chars and count observer churn per keystroke.
  let prev = afterEnv;
  const churn = [];
  for (const ch of "ABCDE") {
    await nameBox.press(ch);
    await page.waitForTimeout(400);
    const now = await page.evaluate(() => window.__obs);
    churn.push({ ch, delta: now - prev });
    prev = now;
  }
  results.steps.push({ at: "name-keystroke-churn", churn });

  // Sample the demo canvas pixels over time to see if the backdrop is redrawn.
  const sig = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return null;
      const off = document.createElement("canvas");
      off.width = 32;
      off.height = 18;
      const x = off.getContext("2d");
      x.drawImage(c, 0, 0, 32, 18);
      const d = x.getImageData(0, 0, 32, 18).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i]) | 0;
      return h;
    });

  await page.waitForTimeout(500);
  const sig1 = await sig();
  await nameBox.press("Q");
  await page.waitForTimeout(800);
  const sig2 = await sig();
  results.steps.push({ at: "backdrop-signature", sig1, sig2, changed: sig1 !== sig2 });

  return results;
}
