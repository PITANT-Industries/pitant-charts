import type { CartesianData } from "./data";
import type { ChartSeries } from "../../types";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const series = (name: string, values: readonly number[]): ChartSeries => ({ name, values });
const chart = (categories: string[], ...series: ChartSeries[]): CartesianData => ({ categories, series });
const waterfall = (categories: string[], values: number[], totals: number[]) =>
  ({ ...chart(categories, series("Net flow", values)), rows: categories.map((_, index) => ({ total: totals.includes(index) })) });

const questions = ["I know what is expected of me", "My manager supports my growth", "I have the tools I need", "Workload is sustainable", "Pay is fair for my role"];
const answers = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export function comparisonFixture(id: string): CartesianData {
  switch (id) {
    case "waterfall-subtotals":
      return waterfall(["Revenue", "Cost of sales", "Gross profit", "R&D", "Sales", "G&A", "Operating", "Interest", "Tax", "Net income"],
        [980, -410, 570, -160, -140, -70, 200, -12, -38, 150], [0, 2, 6, 9]);
    case "waterfall-cash-flow":
      return waterfall([...months.slice(0, 6), "H1"], [18400, -6200, 12900, 9300, -11700, 15100, 37800], [6]);
    case "waterfall-loading":
      return waterfall(["Q1 cash", "Sales", "Services", "Payroll", "Cloud", "Marketing", "Q2 cash"], [2.8, 1.94, .46, -1.32, -.38, -.29, 3.21], [0, 6]);
    case "lollipop-default":
      return chart(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], series("Active users", [8420, 9130, 9660, 9210, 7980, 4310, 3890]));
    case "lollipop-horizontal":
      return chart(["Dashboards", "Alerts", "Saved views", "Exports", "API keys", "Webhooks", "SSO"], series("Teams", [92, 81, 67, 54, 43, 31, 18]));
    case "lollipop-change":
      return chart(["Organic", "Email", "Referral", "Paid search", "Social", "Partners", "Display"], series("Change", [1.8, .9, 2.4, -1.2, -.6, .4, -2.1]));
    case "lollipop-loading":
      return chart(["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm", "10pm"], series("Sessions", [1240, 3860, 5420, 6180, 5710, 4930, 3470, 2890, 1650]));
    case "dumbbell-default":
      return chart(["North America", "Europe", "South America", "Asia Pacific", "Middle East", "Africa"],
        series("Before", [1.48, 1.72, 2.38, 2.21, 2.96, 3.34]), series("After", [.84, .91, 1.26, 1.13, 1.49, 1.71]));
    case "dumbbell-legend":
      return chart(["Engineering", "Design", "Product", "Sales", "Support", "Finance"],
        series("Spring", [64, 58, 69, 52, 61, 73]), series("Winter", [71, 74, 66, 61, 70, 75]));
    case "dumbbell-vertical":
      return chart(["Starter", "Team", "Business", "Scale"],
        series("Billed monthly", [120, 348, 708, 1428]), series("Billed annually", [96, 288, 576, 1152]));
    case "dumbbell-loading":
      return chart(["Engineering", "Design", "Sales", "Support", "Marketing", "Finance"],
        series("Spring", [58, 64, 61, 52, 55, 70]), series("Fall", [72, 81, 66, 77, 69, 74]));
    case "bump-default":
      return chart(["2021", "2022", "2023", "2024", "2025", "2026"],
        series("Python", [17.9, 18.8, 19.6, 21.4, 22.8, 22.1]), series("TypeScript", [9.8, 12.7, 15.3, 17.6, 21.9, 24.5]),
        series("Java", [14.2, 12.9, 11.4, 10.2, 9.1, 8.2]), series("Go", [6.1, 6.6, 7.2, 7.9, 8.3, 8.6]), series("Rust", [2.4, 3.6, 5.1, 7.4, 9.6, 11.2]));
    case "bump-ascending":
      return chart(months.slice(0, 6), series("PayLane", [2.9, 3, 3.2, 3.3, 3.1, 2.8]), series("CardPay", [3.4, 3.1, 2.8, 2.7, 2.9, 3]),
        series("QuickPay", [4.1, 3.9, 3.5, 3, 2.6, 2.4]), series("SwiftPay", [3.8, 3.6, 3.7, 3.4, 3.2, 3.3]));
    case "bump-loading":
      return chart(Array.from({ length: 6 }, (_, i) => `Week ${i + 1}`), series("Atlas", [412, 436, 498, 515, 530, 561]),
        series("Comet", [388, 461, 472, 468, 512, 589]), series("Nova", [455, 449, 431, 482, 494, 503]), series("Orbit", [301, 342, 389, 501, 547, 552]));
    case "slope-default":
      return chart(["2025", "2026"], series("Canada", [78, 84]), series("Germany", [81, 79]), series("Japan", [69, 77]),
        series("Brazil", [72, 70]), series("Australia", [75, 82]), series("India", [64, 73]), series("France", [70, 66]));
    case "slope-response-time":
      return chart(["September", "November"], series("Enterprise", [2.6, 1.2]), series("Business", [5.4, 3.1]), series("Team", [9.6, 7.8]),
        series("Starter", [13.9, 14.6]), series("Free", [26.5, 21]));
    case "slope-loading":
      return chart(["First half", "Second half"], series("API", [55, 51]), series("Billing", [33, 41]), series("Help center", [46, 44]),
        series("Integrations", [28, 35]), series("Mobile app", [41, 48]), series("Web dashboard", [37, 52]));
    case "diverging-default":
      return chart(questions, ...answers.map((name, i) => series(name, [[8, 12, 24, 36, 34], [14, 22, 38, 46, 50], [36, 44, 52, 58, 65], [98, 104, 86, 72, 70], [84, 58, 40, 28, 21]][i])));
    case "diverging-legend":
      return chart(["Free", "Starter", "Pro", "Enterprise"], series("Very dissatisfied", [22, 11, 6, 4]), series("Dissatisfied", [38, 26, 17, 9]),
        series("Satisfied", [214, 188, 152, 71]), series("Very satisfied", [96, 125, 165, 96]));
    case "diverging-loading":
      return chart(["Pricing is clear", "Search finds what I need", "Setup took minutes", "Support answers quickly"],
        ...answers.map((name, i) => series(name, [[27, 6, 15, 19], [44, 18, 26, 31], [55, 30, 41, 47], [74, 112, 96, 88], [30, 64, 52, 45]][i])));
    case "stream-default":
      return chart(["Jan 2025", "Feb 2025", "Mar 2025", "Apr 2025", "May 2025", "Jun 2025", "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026"],
        series("Pop", [420000, 444000, 465000, 482000, 494000, 500000, 499000, 491000, 479000, 464000, 449000, 434000, 423000, 416000, 416000, 422000, 435000, 453000, 475000, 499000, 522000, 543000, 560000, 571000]),
        series("Jazz", [114000, 75000, 67000, 61000, 57000, 55000, 56000, 60000, 66000, 73000, 81000, 119000, 126000, 102000, 105000, 105000, 102000, 97000, 90000, 82000, 74000, 66000, 60000, 86000]),
        series("Rock", [296000, 288000, 278000, 266000, 254000, 241000, 228000, 216000, 206000, 197000, 191000, 187000, 186000, 187000, 190000, 195000, 201000, 208000, 215000, 221000, 226000, 230000, 232000, 231000]),
        series("Hip-hop", [386000, 405000, 409000, 398000, 375000, 345000, 314000, 289000, 274000, 274000, 289000, 318000, 357000, 400000, 441000, 474000, 494000, 500000, 490000, 468000, 438000, 407000, 381000, 366000]),
        series("Electronic", [166000, 205000, 230000, 223000, 195000, 176000, 189000, 225000, 257000, 259000, 235000, 210000, 213000, 245000, 282000, 294000, 275000, 247000, 240000, 266000, 304000, 325000, 314000, 285000]));
    case "stream-expand":
      return chart(["Aug 3", "Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5", "Oct 12", "Oct 19"],
        series("Organic", [5200, 5464, 5692, 5859, 5953, 5980, 5962, 5935, 5933, 5987, 6112, 6308]),
        series("Paid", [3300, 3199, 3077, 2938, 2787, 2631, 2477, 2332, 2202, 2092, 2004, 1937]),
        series("Social", [1800, 2095, 2323, 2447, 2474, 2452, 2451, 2530, 2717, 2990, 3294, 3557]),
        series("Email", [1200, 1267, 1273, 1211, 1739, 1123, 1178, 1253, 1279, 1833, 1156, 1120]),
        series("Referral", [700, 725, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975]));
    case "stream-loading":
      return chart(["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026"],
        series("Web", [420000000, 450000000, 470000000, 455000000, 430000000, 410000000, 400000000, 420000000, 445000000, 460000000]),
        series("API", [310000000, 340000000, 390000000, 460000000, 520000000, 580000000, 610000000, 640000000, 700000000, 760000000]),
        series("Mobile", [180000000, 205000000, 240000000, 260000000, 300000000, 345000000, 390000000, 410000000, 440000000, 470000000]));
    default:
      return waterfall(["FY 2025", "New logos", "Expansion", "Pricing", "Churn", "Downgrades", "FX", "FY 2026"], [4.2, 1.35, .62, .31, -.54, -.21, -.09, 5.64], [0, 7]);
  }
}
