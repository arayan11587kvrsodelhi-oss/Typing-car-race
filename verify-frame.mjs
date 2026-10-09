export default async function run(page, ui) {
  // Ask the page where the WebGL canvas is and how the 3D car projects.
  const s = await ui.snapshot();
  const ref = s.match(/@(e\d+) button "[^"]*START RACE[^"]*"/i)?.[1];
  await ui.click(ref);

  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const gl = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      return c ? !!(c.getContext("webgl2") || c.getContext("webgl")) : false;
    });
    if (gl) break;
  }
  await page.waitForTimeout(1200);

  // Measure the canvas rect and the viewport so we can compute framing.
  const geom = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const panel = document.querySelector('[aria-label="Race typing panel"]');
    const cr = c ? c.getBoundingClientRect() : null;
    const pr = panel ? panel.getBoundingClientRect() : null;
    return {
      canvas: cr ? { x: cr.x, y: cr.y, w: cr.width, h: cr.height, bottom: cr.bottom } : null,
      panel: pr ? { y: pr.y, h: pr.height } : null,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      buffer: c ? { w: c.width, h: c.height } : null,
    };
  });

  return geom;
}
