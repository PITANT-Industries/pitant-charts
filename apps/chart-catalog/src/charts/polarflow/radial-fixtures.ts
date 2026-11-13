// Energy, device storage, and temperature simulation adapted from Bklit UI.
// Copyright (c) 2026 uixmat, MIT. See licenses/Bklit-UI-MIT.md.
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
// Fixed 2026 demonstration observations, through October 29.
const dailyObservations = [
  50.5, 49.1, 48.9, 50.3, 51.1, 51.4, 50.4, 53.9, 50.4, 51, 49.7, 49.6, 52, 52.5,
  53.2, 52.3, 51.1, 50.2, 51.2, 49.3, 47.3, 46.9, 44.9, 43.4, 44.7, 47, 51, 51.5,
  53.7, 51.2, 50.8, 50.7, 50.8, 51.5, 51.7, 51.9, 52.4, 53.2, 54.2, 53.5, 52.3, 51.4,
  53.1, 53.2, 55.2, 52.7, 54.5, 55.2, 53.2, 50.7, 49.8, 51.2, 50.3, 49.6, 51.3, 52.2,
  50.5, 50.3, 51, 51, 50.6, 50.1, 52.3, 53.2, 54.8, 52.9, 54.3, 55, 55.5, 55.6,
  52.1, 55.5, 57.3, 57.4, 59, 58.7, 58.6, 59.5, 59.8, 59.2, 58.6, 57.3, 58.8, 57.6,
  58.2, 56.6, 57, 57.9, 59.6, 57.8, 57.5, 56.2, 56, 56.3, 57.3, 56.4, 56.3, 56.7,
  56.4, 58.3, 58.3, 59.2, 58.9, 58.3, 57.2, 58.4, 58.7, 59.4, 60.4, 59.1, 56, 58,
  59.4, 55.6, 54.3, 53.9, 54, 54.4, 56.5, 56.2, 59.3, 58, 58.1, 59.5, 61.3, 60.1,
  60, 61.1, 57.9, 58.1, 59.3, 59.3, 60.3, 58.3, 58.1, 59.1, 61.3, 60, 61.1, 61.6,
  62.8, 62.1, 60.6, 57.4, 57.9, 56.4, 56.8, 58.9, 57.2, 58.7, 59.1, 58, 58, 60.5,
  61.4, 63, 63.1, 62.6, 62.1, 60.3, 61.2, 62.4, 62.4, 63, 61.5, 57.7, 61.1, 63.8,
  65, 62.8, 64.2, 64.3, 62.3, 60.8, 62.1, 64.3, 62.8, 61.8, 60.8, 60.9, 61.3, 61.2,
  61, 61.1, 62.6, 61.1, 61.1, 64.6, 66, 65.4, 62.1, 63.6, 65, 64.4, 64, 62.9,
  66.2, 64.9, 61.2, 61.6, 63.6, 62, 63.1, 62.4, 64.1, 61.9, 61.4, 62.8, 64.4, 64.3,
  64.1, 63.6, 64.1, 66, 64.1, 64.1, 64.2, 65.3, 66.7, 67.4, 66.5, 65.6, 63.2, 66,
  62.7, 61.8, 62.2, 62.9, 61.7, 60.5, 59.4, 63.1, 64, 66, 67.4, 64.5, 63.3, 64.5,
  67.5, 69.4, 65.8, 67, 67.5, 70.6, 68.9, 69.8, 68.2, 70.4, 68, 69.1, 67.8, 65.9,
  64.5, 63, 61.8, 60.7, 60.5, 60.9, 57.6, 59.2, 61.1, 64.4, 66.2, 64, 60.5, 62.4,
  61.5, 62.3, 63.5, 63, 61.5, 62.1, 63.1, 62.3, 61.4, 59.2, 61.2, 61.7, 62.8, 64,
  64.6, 61.7, 59, 59.5, 59.1, 63.9, 63.5, 62.7, 60.8, 61.7, 59.3, 61.2, 58.9, 59.6,
  62.5, 60, 61.7, 61, 59.5, 59.5, 60.2, 61.5,
];
export const observedTemperatures = normals.filter((_, i) => i !== 59).map((day, i) => {
  const normal = new Date(day.date);
  const date = Date.UTC(year, normal.getUTCMonth(), normal.getUTCDate());
  return { ...day, date, temperature: dailyObservations[i] ?? null };
});

// Demonstration quarter-hour counts measured from the public reference preview.
const pullRequestCounts = [
  [29,0,0], [46,0,0], [59,0,0], [29,0,0], [47,0,0], [29,0,90], [36,0,260], [29,0,520],
  [40,0,720], [29,0,660], [29,0,540], [29,0,380], [71,0,220], [54,0,110], [65,0,40], [48,0,0],
  [84,0,0], [88,0,0], [53,0,0], [104,0,0], [87,0,0], [133,0,0], [116,6,0], [150,0,0],
  [176,13,0], [129,11,0], [221,0,0], [234,14,0], [225,15,0], [292,0,0], [347,0,0], [382,0,0],
  [346,22,0], [426,0,0], [448,27,0], [523,45,0], [476,41,0], [638,0,0], [597,0,0], [620,0,0],
  [739,60,0], [910,0,0], [913,0,0], [1011,0,0], [1023,0,0], [869,0,0], [772,69,0], [692,46,0],
  [562,55,0], [525,41,0], [617,37,0], [623,42,0], [693,53,0], [863,0,0], [881,52,0], [849,79,0],
  [930,79,0], [1041,0,0],
];
const priorDayCounts = [
  [62,60], [40,39], [49,47], [52,50], [48,46], [71,69], [89,86], [84,81],
  [33,32], [60,58], [55,53], [83,79], [80,77], [69,66], [41,39], [83,81],
  [80,77], [70,67], [104,101], [67,64], [69,66], [107,102], [86,83], [127,123],
  [201,192], [233,223], [199,192], [216,208], [321,306], [310,298], [325,311], [407,393],
  [456,440], [500,480], [488,471], [558,533], [589,571], [620,593], [627,601], [652,630],
  [731,702], [779,747], [816,791], [918,875], [954,918], [955,928], [809,778], [819,782],
  [664,634], [630,612], [650,626], [717,689], [756,727], [802,765], [828,800], [809,781],
  [878,852], [944,914], [930,886], [943,909], [881,841], [836,805], [804,774], [794,762],
  [790,754], [770,739], [694,671], [636,615], [646,616], [598,576], [555,538], [599,576],
  [507,489], [590,568], [634,609], [618,593], [660,637], [675,646], [674,653], [813,787],
  [785,762], [809,771], [826,794], [873,838], [835,799], [687,658], [629,609], [579,558],
  [567,547], [492,474], [397,385], [380,367], [304,293], [204,196], [177,170], [83,80],
];

export const quarterHours = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String(i % 4 * 15).padStart(2, "0")}`);
export const lastPullRequestBin = pullRequestCounts.length - 1;
export const pullRequestStatuses = ["Merged", "Ready for merge", "Draft"].map((name, layer) => ({
  name,
  values: quarterHours.map((_, i) => pullRequestCounts[i]?.[layer] ?? null),
}));
export const priorDayTotals = priorDayCounts.map(([total]) => total);
export const priorDayMerged = priorDayCounts.map(([, merged]) => merged);

function averageQuarterHours(values: readonly number[], circular: boolean) {
  return values.map((_, index) => {
    const window = Array.from({ length: 7 }, (_, step) => index + step - 3)
      .map(i => values[circular ? (i + values.length) % values.length : i])
      .filter(value => value !== undefined);
    return Math.round(window.reduce((total, value) => total + value, 0) / window.length);
  });
}

export const pullRequestLines = [
  { name: "Merged today", values: averageQuarterHours(pullRequestCounts.map(([merged]) => merged), false) },
  { name: "Merged yesterday", values: averageQuarterHours(priorDayMerged, true) },
];
