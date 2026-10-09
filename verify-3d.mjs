export default async function run(page, ui) {
  const out = { steps: [] };
  const errs = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  const canvasInfo = () =>
    page.evaluate(() => {
      const cs = Array.from(document.querySelectorAll("canvas"));
      return cs.map((c) => {
        const gl = c.getContext("webgl2") || c.getContext("webgl");
        return {
          w: c.width,
          h: c.height,
          hasGL: !!gl,
          ctx2d: !!c.getContext("2d"),
        };
      });
    });

  // Start screen: confirm the garage is NOT 3D but the race will be.
  out.steps.push({ phase: "start", canvases: await canvasInfo() });

  const s = await ui.snapshot();
  const startRef = s.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];
  await ui.click(startRef);
  await page.waitForTimeout(4200);

  // Race: expect a WebGL canvas now.
  out.steps.push({ phase: "race", canvases: await canvasInfo() });

  // Interrogate the actual Three.js scene graph through R3F's canvas.
  out.scene = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { error: "no canvas" };
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    return {
      hasGL: !!gl,
      version: gl ? gl.getParameter(gl.VERSION) : null,
      drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
    };
  });

  // Type to make the race move, then confirm the sim advanced.
  const read = () =>
    page.evaluate(() => {
      const p = document.querySelector('[aria-label="Current sentence"]');
      const spans = p ? Array.from(p.querySelectorAll("span")) : [];
      const input = document.querySelector('[aria-label="Typing input"]');
      const b = document.body.innerText;
      return {
        target: spans.map((x) => x.textContent).join("").replace(/\u00A0/g, " "),
        i: input ? input.value.length : 0,
        mph: +(b.match(/(\d+)\s*\n?\s*MPH/) || [0, 0])[1],
        combo: +(b.match(/COMBO\s*(\d+)/) || [0, 0])[1],
        score: (b.match(/SCORE\s*([\d,]+)/) || [0, "0"])[1],
      };
    });
  const panel = page.locator('[aria-label="Race typing panel"]');
  await panel.click({ position: { x: 40, y: 60 } }).catch(() => { });
  await page.waitForTimeout(300);

  for (let k = 0; k < 40; k++) {
    const cur = await read();
    const want = cur.target[cur.i];
    if (want === undefined) break;
    await page.keyboard.press(want === " " ? " " : want.toLowerCase());
    await page.waitForTimeout(55);
  }
  await page.waitForTimeout(600);
  out.afterTyping = await read();
  out.errors = errs.slice(0, 8);
  return out;
}
