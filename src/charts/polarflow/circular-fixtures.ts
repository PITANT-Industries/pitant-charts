const sales = {
  names: ["Electronics", "Clothing", "Food", "Home", "Other"],
  values: [4250, 3120, 2100, 1580, 1050],
};

export const pieFixtures = {
  "pie-default": sales,
  "pie-pattern": { names: ["Spent", "Committed", "Remaining"], values: [48000, 21500, 30500] },
  "pie-pattern-presets": { names: ["Compute", "Storage", "Network", "Support"], values: [35, 25, 20, 20] },
  "pie-gradients": { names: ["Annual", "Monthly", "Lifetime"], values: [48200, 36400, 15400] },
} as const;

export const donutFixtures = {
  "pie-center": { label: "Revenue", names: ["Starter", "Pro", "Business", "Enterprise"], values: [18400, 42600, 31200, 27800], currency: true },
  "pie-center-custom": { label: "All product lines", names: ["Headphones", "Speakers", "Microphones", "Accessories", "Other"], values: [2310, 1760, 1340, 980, 610] },
  "pie-center-share": { label: "Total sales", ...sales },
  "pie-hover-legend": { label: "Orders", names: ["Online store", "Retail", "Marketplace", "Wholesale", "Social"], values: [5820, 3940, 2310, 1480, 950] },
  "pie-half-donut": { label: "Sessions", names: ["Direct", "Search", "Social"], values: [4120, 3580, 2460] },
  "pie-donut-grow": { label: "Sessions", names: ["Chrome", "Safari", "Firefox", "Edge", "Other"], values: [27500, 20000, 18700, 17300, 9000] },
  "pie-glow": { label: "Spend", names: ["Compute", "Storage", "Database", "Network"], values: [18420, 9860, 7340, 3120], currency: true },
  "pie-patterns": { label: "Tickets", names: ["Email", "Chat", "Phone", "Forum"], values: [1840, 1320, 760, 480] },
  "pie-pattern-tile": { label: "Tickets", names: ["Open", "Pending", "Solved"], values: [128, 214, 642] },
} as const;

interface RingFixture {
  readonly label: string;
  readonly names: readonly string[];
  readonly values: readonly number[];
  readonly maximum: number | readonly number[];
  readonly sweep: number;
  readonly start: number;
  readonly unit?: string;
}

export const ringFixtures: Readonly<Record<string, RingFixture | undefined>> = {
  "ring-default": { label: "Total Sessions", names: ["Organic", "Paid", "Email", "Social", "Referral"], values: [4250, 3120, 2100, 1580, 1050], maximum: 5000, start: 180, sweep: 360 },
  "ring-arc": { label: "Used", names: ["Photos", "Backups", "Documents"], values: [86, 41, 24], maximum: 200, start: 135, sweep: 270, unit: " GB" },
  "ring-legend": { label: "Signups", names: ["Organic", "Paid", "Referral", "Partners"], values: [4250, 3120, 1480, 860], maximum: [5000, 5000, 2000, 1500], start: 180, sweep: 360 },
  "ring-grid": { label: "Steps", names: ["Ana", "Ben", "Chloe"], values: [8200, 6400, 9100], maximum: 10000, start: 90, sweep: 270 },
  "ring-semicircle": { label: "Key results", names: ["Revenue", "Activation", "Retention"], values: [78, 61, 92], maximum: 100, start: 180, sweep: 180, unit: "%" },
};
