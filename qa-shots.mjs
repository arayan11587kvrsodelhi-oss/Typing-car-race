export default async function run(page, ui) {
  const snap = await ui.snapshot();
  const qaRef = snap.match(/@(e\d+) button ".*(3D AUTOMOTIVE|AUTOMOTIVE STUDIO|3D VEHICLE|STUDIO LINEUP).*"/i)?.[1];
  if (qaRef) {
    await ui.click(qaRef);
    await page.waitForTimeout(2000);
  }

  // Front 3/4 silhouette
  let s = await ui.snapshot();
  const f34 = s.match(/@(e\d+) button "Front 3\/4"/i)?.[1];
  if (f34) {
    await ui.click(f34);
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "qa-front34.png" });

  // Side silhouette
  s = await ui.snapshot();
  const leftRef = s.match(/@(e\d+) button "Left Side"/i)?.[1];
  if (leftRef) {
    await ui.click(leftRef);
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "qa-side.png" });

  // Rear 3/4 silhouette
  s = await ui.snapshot();
  const r34 = s.match(/@(e\d+) button "Rear 3\/4"/i)?.[1];
  if (r34) {
    await ui.click(r34);
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "qa-rear34.png" });

  // Front perspective
  s = await ui.snapshot();
  const frontRef = s.match(/@(e\d+) button "Front"/i)?.[1];
  if (frontRef) {
    await ui.click(frontRef);
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "qa-front.png" });

  return { ok: true, qaRef, wrote: ["qa-front34.png", "qa-side.png", "qa-rear34.png", "qa-front.png"] };
}