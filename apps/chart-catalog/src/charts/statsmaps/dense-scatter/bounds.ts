import type { Bounds } from "./data";

export const day = 86_400_000;
const weekStart = Date.UTC(2026, 9, 5);
export const demoBounds: Bounds = [weekStart, weekStart + 7 * day, 0, 1000];
