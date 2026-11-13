// Energy, device storage, and temperature simulation adapted from Bklit UI.
// Copyright (c) 2026 uixmat, MIT. See upstream/LICENSE.bklit.md.
import { sfTemperatureData } from "./upstream/sf-temperature-data";

export const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const hourEnd = 14;

const energy = [
  [0, .6, .6], [0, .5, .5], [0, .4, .4], [0, .4, .4], [0, .5, .5], [0, .7, .7],
  [.1, 1.3, 1.4], [.4, 1.6, 2], [.9, 1, 1.8], [1.3, .3, 1.5], [1.6, .1, 1.6], [1.8, 0, 1.7],
  [1.9, .2, 2], [1.8, .1, 1.8], [1.5, .2, 1.7], [1.1, .9, 1.9], [.7, 1.4, 2.2], [.3, 2.6, 2.8],
  [.1, 3, 3.2], [0, 2.9, 3], [0, 2.7, 2.6], [0, 1.9, 2], [0, 1.4, 1.3], [0, .8, .8],
];
export const meteredEnergy = [
  { name: "Solar", values: energy.map(([solar], index) => index <= hourEnd ? solar : null) },
  { name: "Grid", values: energy.map(([, grid], index) => index <= hourEnd ? grid : null) },
];
export const forecastEnergy = energy.map(([, , forecast]) => forecast);

const cafe = [[6, 22], [14, 58], [22, 84], [26, 61], [31, 38], [36, 34], [44, 41], [38, 36], [27, 24]];
export const cafeOrders = ["Dine in", "Takeaway"].map((name, layer) => ({
  name,
  values: hours.map((_, index) => index < 6 ? 0 : cafe[index - 6]?.[layer] ?? null),
}));

export const devices = [
  { name: "Phone", capacity: 256, values: [118, 54, 9, 22] },
  { name: "Laptop", capacity: 1024, values: [212, 168, 236, 74] },
  { name: "Cloud", capacity: 2048, values: [846, 0, 412, 0] },
];
export const cloud = [{ name: "Cloud", capacity: 2048, values: [846, 312, 188, 64] }];
export const deviceTypes = ["Photos", "Apps", "Documents", "System"];
export const cloudTypes = ["Photos", "Backups", "Documents", "Mail"];

export const normals = sfTemperatureData.map(day => ({
  ...day,
  label: `${monthNames[new Date(day.date).getUTCMonth()]} ${new Date(day.date).getUTCDate()}`,
}));

export const observedEnd = Date.UTC(2026, 9, 29);
const year = new Date(observedEnd).getUTCFullYear();
let state = year * 7919 + 1;
function random() {
  state = state * 16_807 % 2_147_483_647;
  return (state - 1) / 2_147_483_646;
}

function temperatureYear() {
  random();
  random();
  let anomaly = 0;
  return normals.filter((_, index) => index !== 59).map(day => {
    anomaly = .8 * anomaly + 2.6 * (random() + random() + random() - 1.5);
    const normal = new Date(day.date);
    const date = Date.UTC(year, normal.getUTCMonth(), normal.getUTCDate());
    const temp = Math.min(day.maxmax - 1, Math.max(day.minmin + 1, day.avg + anomaly));
    return { ...day, date, temperature: date <= observedEnd ? Math.round(temp * 10) / 10 : null };
  });
}
export const observedTemperatures = temperatureYear();
