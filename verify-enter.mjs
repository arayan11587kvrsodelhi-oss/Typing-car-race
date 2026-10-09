export default async function run(page, ui) {
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  const snap = () => page.evaluate(() => {
    const b = document.body.innerText;
    const p = document.querySelector('[aria-label="Current sentence"]');
    const spans = p ? Array.from(p.querySelectorAll("span")) : [];
    const gl = document.querySelector("canvas");
    return {
      onStartScreen: /DRIVER NAME|RIVALS|START RACE/i.test(b),
      inRace: !!document.querySelector('[aria-label="Race typing panel"]'),
      countdown: document.querySelector(".animate-countdown")?.textContent ?? null,
      spanCount: spans.length,
      target: spans.map((x) => x.textContent).join("").replace(/\u00A0/g, " "),
      clock: (b.match(/(\d+):(\d{2})/) || [])[0] || null,
      mph: (b.match(/(\d+)\s*\n?\s*MPH/) || [])[1] || null,
      hasGL: gl ? !!(gl.getContext("webgl2") || gl.getContext("webgl")) : false,
    };
  });

  const s0 = await snap();

  // Click Start Race and RETRY until we are actually in the race.
  let attempts = 0;
  let s = s0;
  while (!s.inRace && attempts < 6) {
    attempts++;
    const tree = await ui.snapshot();
    const ref = tree.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];
    if (ref) await ui.click(ref);
    await page.waitForTimeout(1500);
    s = await snap();
  }

  // Poll until the countdown clears and the sentence appears.
  const trace = [];
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(700);
    const cur = await snap();
    trace.push({ at: (i * 0.7).toFixed(1) + "s", ...cur });
    if (cur.spanCount > 0 && cur.countdown === null) break;
  }

  return { firstSnap: s0, clickAttempts: attempts, enteredRace: s.inRace, trace, errors: errs.slice(0, 6) };
}
