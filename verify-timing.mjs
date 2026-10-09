export default async function run(page, ui) {
  const marks = [];
  await page.evaluate(() => {
    window.__marks = [];
    window.__marks.push({ t: performance.now(), what: "before-click" });
  });

  const s = await ui.snapshot();
  const startRef = s.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];

  await page.evaluate(() => {
    // Watch long tasks: anything > 50ms is blocking the main thread.
    window.__long = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__long.push(Math.round(e.duration));
      }).observe({ entryTypes: ["longtask"] });
    } catch { }
  });

  await ui.click(startRef);

  // Poll the race state until it leaves countdown, up to 20s.
  const trace = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const b = document.body.innerText;
      const panel = document.querySelector('[aria-label="Race typing panel"]');
      const p = document.querySelector('[aria-label="Current sentence"]');
      const spans = p ? Array.from(p.querySelectorAll("span")) : [];
      return {
        countdown: document.querySelector(".animate-countdown")?.textContent ?? null,
        clock: (b.match(/(\d+):(\d{2})/) || [])[0] || null,
        mph: (b.match(/(\d+)\s*\n?\s*MPH/) || [])[1] || null,
        spanCount: spans.length,
        target: spans.map((x) => x.textContent).join("").replace(/\u00A0/g, " "),
        panelText: panel ? panel.innerText.replace(/\n/g, " | ").slice(0, 60) : null,
      };
    });
    trace.push({ at: i * 0.5 + "s", ...st });
    if (st.spanCount > 0 && st.countdown === null) break;
  }

  return {
    trace,
    longTasks: await page.evaluate(() => window.__long || []),
  };
}
