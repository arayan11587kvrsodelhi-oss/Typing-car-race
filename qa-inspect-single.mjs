export default async function run(page, ui) {
  const snap = await ui.snapshot();
  const qaRef = snap.match(/@(e\d+) button ".*(3D AUTOMOTIVE|AUTOMOTIVE STUDIO|3D VEHICLE|STUDIO LINEUP).*"/i)?.[1];
  if (qaRef) {
    await ui.click(qaRef);
    await page.waitForTimeout(1500);
  }

  // Switch to Single Car Studio mode
  const s1 = await ui.snapshot();
  const singleBtn = s1.match(/@(e\d+) button "Single Car Studio"/i)?.[1];
  if (singleBtn) {
    await ui.click(singleBtn);
    await page.waitForTimeout(1500);
  }

  // Inspect BMW M3
  let s = await ui.snapshot();
  const bmwBtn = s.match(/@(e\d+) button "BMW M3 Competition.*"/i)?.[1];
  if (bmwBtn) await ui.click(bmwBtn);
  const f34 = s.match(/@(e\d+) button "Front 3\/4"/i)?.[1];
  if (f34) await ui.click(f34);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "inspect-bmw-f34.png" });

  // Inspect Porsche 911
  s = await ui.snapshot();
  const porscheBtn = s.match(/@(e\d+) button "Porsche 911 GT3 RS.*"/i)?.[1];
  if (porscheBtn) await ui.click(porscheBtn);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "inspect-porsche-f34.png" });

  // Inspect Bugatti Chiron
  s = await ui.snapshot();
  const chironBtn = s.match(/@(e\d+) button "Bugatti Chiron.*"/i)?.[1];
  if (chironBtn) await ui.click(chironBtn);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "inspect-chiron-f34.png" });

  // Inspect Lamborghini SVJ
  s = await ui.snapshot();
  const svjBtn = s.match(/@(e\d+) button "Lamborghini Aventador SVJ.*"/i)?.[1];
  if (svjBtn) await ui.click(svjBtn);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "inspect-svj-f34.png" });

  return { ok: true };
}