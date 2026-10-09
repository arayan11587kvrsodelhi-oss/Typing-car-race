export default async function run(page, ui) {
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  const st = () => page.evaluate(() => {
    const p = document.querySelector('[aria-label="Current sentence"]');
    const spans = p ? Array.from(p.querySelectorAll("span")) : [];
    const input = document.querySelector('[aria-label="Typing input"]');
    const b = document.body.innerText;
    const c = document.querySelector("canvas");
    return {
      target: spans.map((x) => x.textContent).join("").replace(/\u00A0/g, " "),
      i: input ? input.value.length : 0,
      green: spans.filter((x) => x.classList.contains("text-emerald-300")).length,
      red: spans.filter((x) => x.classList.contains("text-rose-400")).length,
      mph: +(b.match(/(\d+)\s*\n?\s*MPH/) || [0, 0])[1],
      combo: +(b.match(/COMBO\s*(\d+)/) || [0, 0])[1],
      score: (b.match(/SCORE\s*([\d,]+)/) || [0, "0"])[1],
      acc: (b.match(/ACCURACY\s*([\d.]+)%/) || [0, "?"])[1],
      clock: (b.match(/(\d+):(\d{2})/) || [])[0] || null,
      gl: c ? !!(c.getContext("webgl2") || c.getContext("webgl")) : false,
    };
  });

  // Enter the race.
  const s = await ui.snapshot();
  const ref = s.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];
  await ui.click(ref);

  // Wait for GO! and the 3D canvas.
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const cur = await st();
    if (cur.gl && cur.target) break;
  }

  const panel = page.locator('[aria-label="Race typing panel"]');
  await panel.click({ position: { x: 40, y: 60 } }).catch(() => { });
  await page.waitForTimeout(400);

  // Type the sentence slowly so the engine definitely registers it.
  const before = await st();
  for (let guard = 0; guard < 300; guard++) {
    const cur = await st();
    const want = cur.target[cur.i];
    if (want === undefined) break;
    if (cur.target !== before.target) break;
    await page.keyboard.press(want === " " ? " " : want.toLowerCase());
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(800);
  const after = await st();

  return {
    before,
    after,
    sentenceAdvanced: after.target !== before.target,
    errors: errs.slice(0, 6),
  };
}
