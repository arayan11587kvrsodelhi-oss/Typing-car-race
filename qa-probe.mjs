export default async function run(page, ui) {
  // Measure the generated body meshes directly from the running app.
  const data = await page.evaluate(() => {
    const out = [];
    // The app doesn't expose the generators; read what's on screen instead.
    return { canvases: document.querySelectorAll("canvas").length };
  });
  return data;
}