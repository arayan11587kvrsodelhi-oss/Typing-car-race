import type { EnvironmentId, TimeOfDay, WeatherId } from "./types";
export interface WorldDef { id: EnvironmentId; name: string; blurb: string; weather: WeatherId[]; times: TimeOfDay[]; base: "night" | "sunset" | "dawn"; }
export const WORLDS: WorldDef[] = [
  { id: "night", name: "Neon City", blurb: "Midnight highway.", weather: ["clear", "rain"], times: ["night"], base: "night" },
  { id: "sunset", name: "Sunset Mesa", blurb: "Desert blacktop.", weather: ["clear", "dust"], times: ["sunset"], base: "sunset" },
  { id: "dawn", name: "Alpine Dawn", blurb: "Cold mountain pass.", weather: ["clear", "fog", "snow"], times: ["dawn"], base: "dawn" },
  { id: "night-city", name: "Night City Rain", blurb: "Rain-soaked streets.", weather: ["rain", "heavy-rain", "clear"], times: ["night"], base: "night" },
  { id: "coastal", name: "Coastal Highway", blurb: "Ocean cliffs at sunrise.", weather: ["clear", "fog"], times: ["dawn", "day"], base: "dawn" },
  { id: "desert", name: "Desert Highway", blurb: "Sand and sunset.", weather: ["clear", "dust"], times: ["sunset", "day"], base: "sunset" },
  { id: "alpine", name: "Alpine Pass", blurb: "Snow and fog.", weather: ["snow", "fog", "clear"], times: ["day", "dawn"], base: "dawn" },
  { id: "industrial", name: "Industrial District", blurb: "Factories and steam.", weather: ["fog", "rain", "clear"], times: ["night", "day"], base: "night" },
  { id: "forest", name: "Forest Road", blurb: "Morning fog.", weather: ["fog", "rain", "clear"], times: ["dawn", "day"], base: "dawn" },
  { id: "underground", name: "Neon Underground", blurb: "Tunnel racing.", weather: ["clear"], times: ["night"], base: "night" },
];
export function worldFor(id: EnvironmentId): WorldDef { return WORLDS.find((w) => w.id === id) ?? WORLDS[0]; }
export function baseEnvFor(id: EnvironmentId): "night" | "sunset" | "dawn" { return worldFor(id).base; }