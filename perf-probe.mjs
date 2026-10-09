// Records every 404 / failed request and console warning while entering a race.
export default async function run(page, ui) {
  const bad = [];
  const consoleMsgs = [];
  page.on("response", (r) => { if (r.status() >= 400) bad.push({ status: r.status(), url: r.url() }); });
  page.on("console", (m) => { if (m.type() !== "log") consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });

  await page.reload();
  await page.waitForTimeout(2500);
  const snap = await ui.snapshot();
  const startRef = snap.match(/@(e\d+) button "[^"]*(Start|Race|RACE)[^"]*"/)?.[1];
  if (startRef) await ui.click(startRef);
  await page.waitForTimeout(6000);

  // Type continuously for a few seconds
  for (let i = 0; i < 60; i++) {
    await page.keyboard.type("the ", { delay: 20 });
  }
  await page.waitForTimeout(1000);
  const hud = await page.evaluate(() => document.querySelector("[data-perf-hud]")?.textContent ?? null);
  return { startRef, bad, consoleMsgs: consoleMsgs.slice(0, 40), hud, snap: snap.slice(0, 1500) };
}
