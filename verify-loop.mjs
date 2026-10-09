export default async function run(page, ui) {
  const out = {};
  const errs = [];
  page.on("console", (m) => errs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  const s = await ui.snapshot();
  const startRef = s.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];
  await ui.click(startRef);
  await page.waitForTimeout(2500);

  // Count renderer animation frames to see if the loop is alive at all.
  await page.evaluate(() => {
    window.__raf = 0;
    const loop = () => {
      window.__raf++;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.waitForTimeout(2500);

  out.rafFrames = await page.evaluate(() => window.__raf);
  out.state = await page.evaluate(() => {
    const panel = document.querySelector('[aria-label="Race typing panel"]');
    return {
      panelText: panel ? panel.innerText.replace(/\n/g, " | ") : null,
      // the countdown overlay is a separate absolutely-positioned element
      countdownVisible: !!document.querySelector(".animate-countdown"),
      countdownText: document.querySelector(".animate-countdown")?.textContent ?? null,
      bodySnippet: document.body.innerText.slice(0, 160),
    };
  });
  out.errors = errs.slice(0, 10);
  return out;
}
