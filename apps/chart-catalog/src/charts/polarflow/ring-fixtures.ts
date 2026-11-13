interface RingFixture {
  readonly label: string;
  readonly names: readonly string[];
  readonly values: readonly number[];
  readonly maximum: number | readonly number[];
  readonly size: number;
  readonly radii: readonly [inner: number, outer: number, thickness: number];
  readonly start: number;
  readonly sweep: number;
  readonly fontSize: number;
  readonly roundedTrack?: boolean;
  readonly grid?: readonly number[];
  readonly unit?: string;
}

export const ringFixtures: Readonly<Record<string, RingFixture>> = {
  "ring-default": {
    label: "Total Sessions", names: ["Organic", "Paid", "Email", "Social", "Referral"], values: [4250, 3120, 2100, 1580, 1050],
    maximum: 5000, size: 300, radii: [71, 142, 71 / 6], start: -90, sweep: 360, fontSize: 22.51,
  },
  "ring-center-custom": {
    label: "Bookings", names: ["New business", "Expansion", "Renewals"], values: [38000, 12500, 26400],
    maximum: [50000, 20000, 30000], size: 260, radii: [72, 108, 12], start: -90, sweep: 360, fontSize: 22.88,
  },
  "ring-arc": {
    label: "Used", names: ["Photos", "Backups", "Documents"], values: [86, 41, 24],
    maximum: 200, size: 300, radii: [66, 106, 16], start: -135, sweep: 270, fontSize: 18.48, unit: " GB",
  },
  "ring-legend": {
    label: "Signups", names: ["Organic", "Paid", "Referral", "Partners"], values: [4250, 3120, 1480, 860],
    maximum: [5000, 5000, 2000, 1500], size: 240, radii: [64, 112, 32 / 3], start: -90, sweep: 360, fontSize: 19.94,
  },
  "ring-grid": {
    label: "Steps", names: ["Ana", "Ben", "Chloe"], values: [8200, 6400, 9100],
    maximum: 10000, size: 300, radii: [72, 108, 12], start: -180, sweep: 270, fontSize: 22.88, roundedTrack: true, grid: [0, 25, 50, 75, 100],
  },
  "ring-semicircle": {
    label: "Key results", names: ["Revenue", "Activation", "Retention"], values: [78, 61, 92],
    maximum: 100, size: 300, radii: [72, 108, 12], start: -90, sweep: 180, fontSize: 22.88, roundedTrack: true, grid: [0, 50, 100], unit: "%",
  },
};
