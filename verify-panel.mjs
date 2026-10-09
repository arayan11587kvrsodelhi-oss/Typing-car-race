export default async function run(page, ui) {
  const out = {};
  const errs = [];
  page.on("console", (m) => errs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  const s = await ui.snapshot();
  const startRef = s.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];
  await ui.click(startRef);

  // Sample the panel repeatedly from the moment the race mounts, so we can see
  // whether the sentence EVER appears (countdown -> running).
  const samples = [];
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(600);
    samples.push(
      await page.evaluate((tick) => {
        const p = document.querySelector('[aria-label="Current sentence"]');
        const spans = p ? Array.from(p.querySelectorAll("span")) : [];
        const panel = document.querySelector('[aria-label="Race typing panel"]');
        const b = document.body.innerText;
        return {
          tick,
          panelPresent: !!panel,
          panelText: panel ? panel.innerText.replace(/\n/g, " | ").slice(0, 90) : null,
          spanCount: spans.length,
          target: spans.map((x) => x.textContent).join("").replace(/\u00A0/g, " "),
          clock: (b.match(/(\d+):(\d{2})/) || [])[0] || null,
          mph: (b.match(/(\d+)\s*\n?\s*MPH/) || [])[1] || null,
          countdown: /^\s*(3|2|1|GO!)/.test(b) ? b.trim().slice(0, 4) : null,
        };
      }, t),
    );
  }
  out.samples = samples;
  out.errors = errs.slice(0, 10);
  return out;
}
