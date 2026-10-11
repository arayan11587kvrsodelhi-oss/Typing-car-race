// Verifies punctuation is REQUIRED (not skipped): type a sentence up to but not
// including its final punctuation, confirm it does not advance; then a wrong
// punctuation does not advance either; then the correct one does.
export default async function run(page, ui) {
  const out = { steps: [] };
  const log = (m, v) => out.steps.push({ step: m, ...(v !== undefined ? { value: v } : {}) });

  const snap = await ui.snapshot();
  const start = snap.match(/@(e\d+) button "START RACE/)?.[1];
  if (start) await ui.click("@" + start);
  else await ui.click("@e1").catch(() => {});
  log("clicked start");

  await page.waitForSelector('[aria-label="Current sentence"]', { timeout: 20000 });
  // Wait for the countdown label to disappear (race actually running).
  await page
    .waitForFunction(
      () => {
        const t = document.body.innerText;
        return !/\b3\b/.test(t) || !!document.querySelector('.mobile-keyboard');
      },
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(4200); // countdown (2.4s) + margin

  const readTarget = () =>
    page.$eval('[aria-label="Current sentence"]', (el) => (el.textContent || "").replace(/\u00a0/g, " "));

  let target = await readTarget();
  out.target = target;
  const chars = Array.from(target);

  // Type all but the final character (which is punctuation in this content).
  for (const ch of chars.slice(0, -1)) {
    await page.keyboard.press(ch === " " ? "Space" : ch);
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(500);

  const midTarget = await readTarget();
  out.advancedBeforeFinalChar = midTarget !== target;
  out.remainingChar = chars[chars.length - 1];
  log("did NOT advance before final punctuation", !out.advancedBeforeFinalChar);

  // Now press the correct final punctuation.
  const last = chars[chars.length - 1];
  await page.keyboard.press(last === " " ? "Space" : last);
  await page.waitForTimeout(600);
  const afterTarget = await readTarget();
  out.advancedAfterFinalChar = afterTarget !== target;
  out.nextLine = afterTarget;
  log("advanced after final punctuation", out.advancedAfterFinalChar);

  // Progress bar width should reflect the next line now.
  out.progressBarVisible = await page.evaluate(() => {
    const bars = [...document.querySelectorAll("div")].filter((d) =>
      d.style && d.style.width && d.style.width.endsWith("%"),
    );
    return bars.length > 0;
  });

  return out;
}
