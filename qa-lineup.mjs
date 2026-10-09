export default async function run(page, ui) {
  // Open the QA view
  const snap = await ui.snapshot();
  const qaRef = snap.match(/@(e\d+) button ".*3D VEHICLE VISUAL QA/)?.[1];
  if (!qaRef) return { error: "no QA button", snap };
  await ui.click(qaRef);
  await page.waitForTimeout(1500);

  // Switch to the All-7 lineup mode
  const after = await ui.snapshot();
  const lineupRef = after.match(/@(e\d+) button "All 7 Lineup/)?.[1];
  if (lineupRef) {
    await ui.click(lineupRef);
    await page.waitForTimeout(1500);
  }

  // Set Left Side silhouette camera for the cleanest silhouette read
  const s2 = await ui.snapshot();
  const leftRef = s2.match(/@(e\d+) button "Left Side"/)?.[1];
  if (leftRef) {
    await ui.click(leftRef);
    await page.waitForTimeout(2500);
  }

  const finalSnap = await ui.snapshot();
  const canvasCount = await page.evaluate(() => document.querySelectorAll("canvas").length);
  return { canvasCount, lineupRef, leftRef, hasLineup: !!lineupRef, finalSnap };
}