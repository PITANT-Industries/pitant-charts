const conversionLabels = ["Control", "Shorter form", "Social proof", "Annual default", "Free trial"];
const forestLabels = ["Welcome checklist", "Sample project", "Invite prompt", "Product tour", "Email nudges", "Template gallery"];
const planLabels = ["Free", "Starter", "Pro", "Team", "Enterprise"];

const conversion = [[4.1, 3.8, 4.4], [4.6, 4.2, 5], [5.2, 4.8, 5.7], [3.9, 3.5, 4.4], [4.5, 4, 5.1]];
const forest = [[3.4, 1.7, 5.1], [2.1, .3, 3.9], [1.2, -1, 3.4], [-.4, -2.1, 1.3], [.8, -.4, 2], [2.7, .8, 4.6]];
const sessions = [[3.3, 3, 3.6], [4.6, 4.1, 5.1], [5.8, 5.2, 6.4], [7, 6.1, 7.9], [8.2, 6.8, 9.6]];

export function errorBars(forestPlot: boolean, loadingExample: boolean) {
  const labels = forestPlot ? forestLabels : loadingExample ? planLabels : conversionLabels;
  const values = forestPlot ? forest : loadingExample ? sessions : conversion;
  return labels.map((label, i) => {
    const [value, low, high] = values[i];
    return { label, value, low, high };
  });
}

export const sessionSkeleton = [
  [.357026, .723981, .560480], [.205180, .592326, .408153], [.064556, .563405, .332230],
  [.361487, .797074, .585276], [.325755, .747530, .535060],
];

const latency = [182, 178, 185, 191, 176, 168, 171, 188, 196, 204, 199, 187, 179, 174, 172, 181, 193, 215, 228, 219, 201, 189, 183, 177, 175, 184, 190, 186, 180, 176];
const latency10 = [131, 129, 133, 137, 128, 123, 125, 135, 140, 145, 142, 134, 130, 126, 125, 131, 138, 152, 160, 154, 143, 136, 132, 128, 127, 133, 136, 134, 130, 128];
const latency25 = [158, 155, 160, 165, 153, 146, 149, 163, 169, 176, 172, 162, 155, 151, 150, 157, 167, 185, 195, 188, 173, 164, 159, 154, 152, 159, 164, 161, 156, 153];
const latency75 = [216, 211, 220, 227, 209, 198, 202, 224, 234, 244, 237, 222, 212, 206, 204, 215, 230, 258, 274, 263, 240, 225, 217, 210, 207, 219, 226, 221, 214, 209];
const latency90 = [263, 257, 268, 278, 254, 241, 246, 273, 286, 299, 291, 271, 259, 250, 247, 262, 281, 317, 338, 323, 294, 275, 265, 255, 252, 267, 276, 270, 260, 254];

const revenue = [412, 428, 441, 437, 459, 472, 484, 495, 507, 518, 531, 543];
const forecastLow = [472, 464, 466, 469, 472, 477, 481];
const forecastInnerLow = [472, 471, 476, 483, 489, 497, 504];
const forecastInnerHigh = [472, 497, 514, 531, 547, 565, 582];
const forecastHigh = [472, 504, 525, 545, 564, 585, 605];
export const forecastSeam = 5;

export function ribbonSamples(forecast: boolean) {
  if (forecast) return revenue.map((value, i) => {
    const index = i - forecastSeam;
    const date = Date.UTC(2026, i, 1);
    // Local month boundaries in the reference have a one-hour offset during daylight saving time.
    const time = i >= 3 && i <= 9 ? date - 3_600_000 : date;
    return { value, date, time, low: forecastLow[index] ?? value,
      high: forecastHigh[index] ?? value, innerLow: forecastInnerLow[index] ?? value,
      innerHigh: forecastInnerHigh[index] ?? value };
  });
  return latency.map((value, i) => {
    const date = Date.UTC(2026, 5, i + 1);
    return { value, date, time: date, low: latency10[i], high: latency90[i],
      innerLow: latency25[i], innerHigh: latency75[i] };
  });
}
