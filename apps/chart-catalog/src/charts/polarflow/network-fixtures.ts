export type NetworkNode = { name: string; group: number; value?: number; x: number; y: number; radius: number };
export type NetworkEdge = { source: number; target: number; width: number };
interface NetworkFixture { groups: readonly string[]; nodes: readonly NetworkNode[]; links: readonly NetworkEdge[]; }

const defaultNodes = [
  { name: "Web app", group: 0, value: 4200, x: 0.59865927, y: 0.87514516, radius: 9.89 },
  { name: "Mobile API", group: 0, value: 2900, x: 0.43077621, y: 0.90669355, radius: 8.90 },
  { name: "Admin", group: 0, value: 300, x: 0.31721774, y: 0.61387097, radius: 5.57 },
  { name: "Gateway", group: 1, value: 7400, x: 0.45646169, y: 0.73530645, radius: 11.82 },
  { name: "Auth", group: 1, value: 5100, x: 0.23489919, y: 0.66579032, radius: 10.49 },
  { name: "Users", group: 1, value: 2600, x: 0.43428427, y: 0.56559677, radius: 8.64 },
  { name: "Orders", group: 1, value: 1400, x: 0.50379032, y: 0.44611290, radius: 7.40 },
  { name: "Billing", group: 1, value: 600, x: 0.41627016, y: 0.26975806, radius: 6.23 },
  { name: "Catalog", group: 1, value: 3300, x: 0.70959677, y: 0.62804839, radius: 9.22 },
  { name: "Search", group: 1, value: 2100, x: 0.21280242, y: 0.82969355, radius: 8.17 },
  { name: "Notifications", group: 1, value: 800, x: 0.79581653, y: 0.17130645, radius: 6.57 },
  { name: "Postgres", group: 2, value: 6100, x: 0.61467742, y: 0.43991935, radius: 11.10 },
  { name: "Redis", group: 2, value: 7900, x: 0.05784274, y: 0.67656452, radius: 12.08 },
  { name: "Kafka", group: 2, value: 2200, x: 0.77356855, y: 0.37846774, radius: 8.26 },
  { name: "Elasticsearch", group: 2, value: 2000, x: 0.06093750, y: 0.89008065, radius: 8.07 },
  { name: "Warehouse", group: 2, value: 500, x: 0.94215726, y: 0.35087097, radius: 6.03 },
  { name: "CDN", group: 3, value: 9800, x: 0.73676411, y: 0.96935484, radius: 13.00 },
  { name: "Payments", group: 3, value: 300, x: 0.24283266, y: 0.19804839, radius: 5.57 },
  { name: "Object storage", group: 3, value: 1200, x: 0.89026210, y: 0.66832258, radius: 7.15 },
  { name: "Email", group: 3, value: 400, x: 0.67785282, y: 0.03064516, radius: 5.82 },
];

const defaultLinks = edgeList([
  [0,16,3], [0,3,3.25], [1,3,2.75], [2,3,1.5], [3,4,3.25], [3,5,2.5],
  [3,6,2.25], [3,8,3], [3,9,2.5], [4,5,2], [4,12,3.25], [5,11,2.25],
  [6,11,2.5], [6,7,2], [6,13,2.25], [7,17,1.75], [7,11,1.75], [8,11,2.75],
  [8,18,2], [8,13,1.5], [9,14,3], [9,12,1.75], [13,10,2], [13,15,2.5],
  [10,19,1.75],
]);

const legendNodes = [
  { name: "Ava", group: 0, x: 0.28784653, y: 0.15420792, radius: 9.47 },
  { name: "Noah", group: 0, x: 0.03990099, y: 0.27282178, radius: 8.87 },
  { name: "Mia", group: 0, x: 0.07434406, y: 0.11224422, radius: 9.47 },
  { name: "Liam", group: 0, x: 0.16867574, y: 0.02640264, radius: 8.16 },
  { name: "Zoe", group: 0, x: 0.16238861, y: 0.27892739, radius: 8.87 },
  { name: "Ethan", group: 1, x: 0.48561881, y: 0.36854785, radius: 10.00 },
  { name: "Isla", group: 1, x: 0.22580446, y: 0.41011551, radius: 8.87 },
  { name: "Leo", group: 1, x: 0.31433168, y: 0.30259076, radius: 9.47 },
  { name: "Ruby", group: 1, x: 0.25073020, y: 0.56772277, radius: 9.47 },
  { name: "Owen", group: 1, x: 0.23350248, y: 0.79272277, radius: 8.87 },
  { name: "Lena", group: 1, x: 0.43001238, y: 0.64838284, radius: 8.87 },
  { name: "Kai", group: 2, x: 0.52571782, y: 0.73085809, radius: 10.00 },
  { name: "Nora", group: 2, x: 0.39353960, y: 0.93183168, radius: 8.87 },
  { name: "Theo", group: 2, x: 0.59081683, y: 0.89764026, radius: 10.00 },
  { name: "Ivy", group: 2, x: 0.78636139, y: 0.97359736, radius: 8.87 },
  { name: "Finn", group: 2, x: 0.75175743, y: 0.78942244, radius: 8.87 },
  { name: "Maya", group: 3, x: 0.76407178, y: 0.51486799, radius: 10.00 },
  { name: "Eli", group: 3, x: 0.92695545, y: 0.76462046, radius: 8.87 },
  { name: "Rosa", group: 3, x: 0.96009901, y: 0.60929043, radius: 9.47 },
  { name: "Jude", group: 3, x: 0.79884901, y: 0.68396040, radius: 8.87 },
];

const legendLinks = edgeList([
  [0,1,2.35], [1,2,2.8], [2,3,3.25], [3,4,2.35], [4,0,2.8], [0,2,1.9],
  [5,6,2.35], [6,7,2.8], [7,8,3.25], [8,9,2.35], [9,10,2.8], [10,5,3.25],
  [5,7,1.9], [11,12,2.35], [12,13,2.8], [13,14,3.25], [14,15,2.35], [15,11,2.8],
  [11,13,1.9], [16,17,2.35], [17,18,2.8], [18,19,3.25], [19,16,2.35], [16,18,1.9],
  [0,5,2.8], [1,6,2.35], [2,7,1.9], [8,11,2.8], [9,12,2.35], [10,13,1.9],
  [11,16,2.35], [14,17,2.8], [15,18,1.9], [5,16,1.9], [4,8,2.35], [13,19,1.9],
]);

const loadingNodes = [
  { name: "Design", group: 0, value: 18, x: 0.31156250, y: 0.66251613, radius: 10.55 },
  { name: "Tokens", group: 0, value: 26, x: 0.40673387, y: 0.96935484, radius: 11.87 },
  { name: "Icons", group: 0, value: 12, x: 0.05300403, y: 0.59351613, radius: 9.35 },
  { name: "Frontend", group: 1, value: 30, x: 0.53674395, y: 0.71690323, radius: 12.45 },
  { name: "Components", group: 1, value: 34, x: 0.22425403, y: 0.78879032, radius: 13.00 },
  { name: "Docs", group: 1, value: 10, x: 0.26558468, y: 0.38330645, radius: 8.88 },
  { name: "Search", group: 1, value: 8, x: 0.48593750, y: 0.13475806, radius: 8.37 },
  { name: "API", group: 2, value: 28, x: 0.73676411, y: 0.37770968, radius: 12.17 },
  { name: "Auth", group: 2, value: 14, x: 0.94699597, y: 0.26450000, radius: 9.78 },
  { name: "Billing", group: 2, value: 9, x: 0.60608871, y: 0.03064516, radius: 8.63 },
  { name: "Database", group: 2, value: 22, x: 0.78700605, y: 0.04116129, radius: 11.24 },
];

const loadingLinks = edgeList([
  [0,1,2.5], [0,2,2], [0,3,2.25], [3,1,2.75], [3,4,3.25], [3,7,2.5],
  [4,1,3], [4,2,2.25], [4,5,2], [7,8,2.5], [7,9,1.75], [7,10,3],
  [8,10,2], [9,10,1.75], [5,6,1.75], [6,10,1.5],
]);

function edgeList(rows: [number, number, number][]): NetworkEdge[] {
  return rows.map(([source, target, width]) => ({ source, target, width }));
}

export const networkFixtures: Record<string, NetworkFixture> = {
  "network-default": { groups: ["Clients", "Services", "Data", "Vendors"], nodes: defaultNodes, links: defaultLinks },
  "network-legend": { groups: ["Design", "Web", "Platform", "Data"], nodes: legendNodes, links: legendLinks },
  "network-loading": { groups: ["Design", "Frontend", "Backend"], nodes: loadingNodes, links: loadingLinks },
};

// The loading overview contains three groups of five nodes around one hub each.
export const networkPlaceholder = [
  {
    nodes: [
      [0.465314215, 0.203925467, 5.39],
      [0.562221232, 0.085011618, 5.52],
      [0.648834822, 0.128442607, 5.21],
      [0.684655032, 0.254568795, 5.01],
      [0.661515063, 0.358923855, 6.17],
    ],
    hub: [0.592582408, 0.246369368, 11.05],
  },
  {
    nodes: [
      [0.739386239, 0.625773148, 5.45],
      [0.774444661, 0.710797773, 5.5],
      [0.711080829, 0.812694455, 4.26],
      [0.609408902, 0.841191775, 6.08],
      [0.549371024, 0.718141220, 6.8],
    ],
    hub: [0.673359367, 0.706994034, 11.05],
  },
  {
    nodes: [
      [0.281551154, 0.679339232, 4.04],
      [0.168352461, 0.658287635, 4.07],
      [0.138218516, 0.561349996, 6.26],
      [0.161222270, 0.443664161, 6.39],
      [0.260359765, 0.403135296, 6.83],
    ],
    hub: [0.234058225, 0.546636599, 11.05],
  },
] as const;
