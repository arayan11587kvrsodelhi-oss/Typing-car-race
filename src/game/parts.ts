export interface PartOption { id: string; name: string; price: number; desc: string; }
export const PART_CATALOG: Record<string, PartOption[]> = {
  paint: [{ id: "#e11d48", name: "Crimson", price: 0, desc: "Stock paint" }, { id: "#1d4ed8", name: "Azure", price: 150, desc: "Metallic blue" }, { id: "#111827", name: "Midnight", price: 250, desc: "Dark gloss" }],
  wheels: [{ id: "sport", name: "Sport Alloy", price: 250, desc: "Light alloy" }, { id: "forged", name: "Forged GT", price: 900, desc: "Forged wheel" }, { id: "carbon", name: "Carbon Aero", price: 1200, desc: "Carbon aero" }, { id: "track", name: "Track Centre-lock", price: 1500, desc: "Motorsport look" }],
  spoiler: [{ id: "stock", name: "Stock", price: 0, desc: "Factory aero" }, { id: "lip", name: "Lip", price: 200, desc: "Ducktail lip" }, { id: "wing", name: "Wing", price: 450, desc: "Street wing" }, { id: "gt", name: "GT Wing", price: 800, desc: "Large GT wing" }],
};
export function partInfo(id: string): string { return PART_CATALOG.wheels.find((w) => w.id === id)?.desc ?? "Performance part"; }