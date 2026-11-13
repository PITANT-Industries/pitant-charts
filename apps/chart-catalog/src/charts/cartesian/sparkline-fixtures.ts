import type { ChartSeries } from "../../types";
import { dates, type CartesianData } from "./data";

const lastDay = Date.UTC(2026, 10, 8);
const day = 86_400_000;

// Adapted from Bklit UI's sparkline gallery, copyright (c) 2026 uixmat, MIT.
// See licenses/Bklit-UI-MIT.md.
function galleryValues(seed: number, length: number, base: number, trend: number) {
  return Array.from({ length }, (_, index) => Math.round(
    base + trend * index
    + Math.sin(index * .7 + seed) * base * .12
    + Math.cos(index * 1.9 + seed * 2) * base * .06,
  ));
}

function storefrontSeries(): ChartSeries[] {
  return [
    { name: "Revenue", values: galleryValues(1, 24, 4200, 40) },
    { name: "Visitors", values: galleryValues(2, 24, 1800, -12) },
    { name: "Orders", values: galleryValues(3, 24, 120, 2) },
  ];
}

const dailyUsers = [
  5610, 5922, 5936, 5738, 5482, 5286, 5254, 5449, 5759, 5888, 5620, 5093, 4729, 4809, 5195,
  5489, 5443, 5155, 4876, 4773, 4874, 5152, 5517, 5770, 5715, 5397, 5156, 5316, 5830, 6299,
  6377, 6097, 5777, 5674, 5800, 6029, 6236, 6308, 6136, 5734, 5345, 5286, 5608, 5986, 6020,
  5654, 5214, 5057, 5247, 5581, 5845, 5951, 5886, 5687, 5503, 5570, 5980, 6500, 6730, 6511,
  6107, 5939, 6159, 6548, 6792, 6765, 6541, 6240, 5982, 5905, 6094, 6413, 6537, 6254, 5739,
  5423, 5560, 5982, 6300, 6303, 6087, 5874, 5803, 5921, 6231, 6642, 6917, 6845, 6498, 6242,
];

export function sparklineFixture(id: string): CartesianData {
  const storefront = storefrontSeries();
  const daily = (series: ChartSeries[], count = 24) => ({ categories: dates(count, lastDay - (count - 1) * day), series });
  switch (id) {
    case "sparkline-line": return daily([storefront[0]]);
    case "sparkline-area":
    case "sparkline-area-solid": return daily([storefront[1]]);
    case "sparkline-bar": return daily([storefront[2]]);
    case "sparkline-bar-negative": return daily([{ name: "Daily P&L", values: Array.from({ length: 20 }, (_, index) => Math.round(Math.sin(index * .9) * 420 + Math.cos(index * 2.3) * 180 + 40)) }], 20);
    case "sparkline-end-dot": return daily([{ name: "p95 latency", values: galleryValues(5, 32, 240, 0) }], 32);
    case "sparkline-step": return { categories: dates(120, Date.UTC(2026, 6, 12)).filter((_, index) => index % 7 === 0), series: [{ name: "Paid seats", values: [5, 5, 5, 8, 8, 8, 8, 12, 12, 10, 10, 15, 15, 15, 20, 20, 18, 25] }] };
    case "sparkline-crosshairs": return daily([storefront[0], storefront[0], storefront[0]]);
    case "sparkline-hover-feel": return daily([storefront[0], storefront[0], storefront[0], storefront[2]]);
    case "sparkline-table": return {
      categories: dates(106, lastDay - 105 * day).filter((_, index) => index % 7 === 0),
      series: [
        { name: "Starter", values: galleryValues(11, 16, 320, 6).map(value => value * 1000) },
        { name: "Pro", values: galleryValues(12, 16, 880, 18).map(value => value * 1000) },
        { name: "Team", values: galleryValues(13, 16, 540, -9).map(value => value * 1000) },
        { name: "Enterprise", values: galleryValues(14, 16, 1260, 4).map(value => value * 1000) },
      ],
    };
    case "sparkline-stat-card": return {
      categories: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      series: [{ name: "Active sessions", values: [920, 1380, 1120, 1580, 1240, 1710, 1460] }],
      rows: [850, 920, 1380, 1120, 1580, 1240, 1710].map(previous => ({ previous })),
    };
    case "sparkline-range": return daily([{ name: "Daily active users", values: dailyUsers }], 90);
    case "sparkline-grid": return {
      categories: Array.from({ length: 20 }, (_, index) => `11:${String(40 + index).padStart(2, "0")}`),
      series: Array.from({ length: 48 }, (_, index) => ({ name: `Service ${index + 1}`, values: galleryValues(index, 20, 100, index % 7 - 3) })),
    };
    default: return daily(storefront);
  }
}
