import type { Marker } from "./geo-fixtures";

export const paymentLive = new Set(["Canada", "United States of America", "Norway", "France", "Sweden", "Germany", "Belgium", "Netherlands", "Portugal", "Spain", "Ireland", "New Zealand", "Australia", "Italy", "Denmark", "United Kingdom", "Finland", "Japan"]);
export const paymentBeta = new Set(["Indonesia", "Argentina", "Chile", "South Africa", "Mexico", "Brazil", "Colombia", "South Korea", "India", "Poland"]);
export const infrastructureMarkers: Marker[] = [
  { at: [-77.49, 39.04], label: "Primary region", value: 1, category: "Infrastructure" },
  { at: [8.68, 50.11], label: "Edge cache", value: 1, category: "Infrastructure" },
  { at: [103.82, 1.35], label: "Failover", value: 1, category: "Infrastructure" },
  { at: [151.21, -33.87], label: "Backups", value: 1, category: "Infrastructure" },
  { at: [-46.63, -23.55], label: "Status probe", value: 1, category: "Infrastructure" },
];
export const infrastructureShapes = ["pin", "circle", "diamond", "square", "triangle"];

const visitorSteps = [
  ["Argentina", "Chile", "Kenya", "Norway", "South Africa", "Colombia", "Nigeria", "Vietnam", "Pakistan", "Austria", "Romania", "New Zealand", "Denmark", "Finland", "Czechia", "Egypt"],
  ["Indonesia", "Mexico", "Israel", "South Korea", "Sweden", "Ukraine", "Poland", "Turkey", "Switzerland", "Belgium", "Portugal", "Ireland", "China", "Philippines"],
  ["Canada", "Brazil", "Netherlands", "Spain", "Australia", "Italy", "Japan"],
  ["United States of America", "France", "India", "Germany", "United Kingdom"],
];
const signupSteps = [
  ["Mexico", "Nigeria", "Netherlands"], ["Brazil", "Spain", "Australia", "Japan"],
  ["Canada", "France", "United Kingdom"], ["United States of America", "India", "Germany"],
];

export const visitorBuckets = new Map(visitorSteps.flatMap((names, step) => names.map(name => [name, step + 1] as const)));
export const signupBuckets = new Map(signupSteps.flatMap((names, step) => names.map(name => [name, step + 1] as const)));

export const visitorCounts = new Map<string, number>([
  ["United States of America", 184_560],
  ["Mexico", 9_640],
  ["Canada", 38_250],
  ["Colombia", 2_870],
  ["Chile", 2_210],
  ["Argentina", 3_120],
  ["Brazil", 18_960],
  ["Portugal", 5_710],
  ["Ireland", 6_150],
  ["France", 41_730],
  ["Spain", 17_380],
  ["United Kingdom", 63_420],
  ["Belgium", 5_030],
  ["Netherlands", 22_350],
  ["Nigeria", 4_120],
  ["Switzerland", 8_740],
  ["Denmark", 4_890],
  ["Germany", 58_910],
  ["Italy", 16_240],
  ["Norway", 4_380],
  ["Austria", 4_210],
  ["Czechia", 3_340],
  ["Sweden", 9_120],
  ["Poland", 11_870],
  ["Romania", 3_960],
  ["South Africa", 4_730],
  ["Finland", 3_720],
  ["Egypt", 1_640],
  ["Ukraine", 5_840],
  ["Israel", 5_470],
  ["Turkey", 6_930],
  ["Kenya", 1_980],
  ["Pakistan", 2_460],
  ["India", 47_320],
  ["China", 6_480],
  ["Vietnam", 4_590],
  ["Indonesia", 7_860],
  ["Philippines", 5_260],
  ["South Korea", 12_640],
  ["Australia", 21_480],
  ["Japan", 26_870],
  ["New Zealand", 3_480],
]);
export const signupCounts = new Map<string, number>([
  ["United States of America", 9_870],
  ["Mexico", 1_420],
  ["Canada", 3_120],
  ["Brazil", 2_260],
  ["France", 2_780],
  ["Spain", 1_530],
  ["United Kingdom", 3_890],
  ["Netherlands", 1_180],
  ["Nigeria", 960],
  ["Germany", 4_310],
  ["India", 5_120],
  ["Australia", 1_840],
  ["Japan", 1_960],
]);

const keyboardOrder = [
  "United States of America", "Mexico", "Canada", "Guatemala", "El Salvador", "Belize",
  "Honduras", "Nicaragua", "Costa Rica", "Panama", "Cuba", "Ecuador",
  "Bahamas", "Jamaica", "Peru", "Colombia", "Haiti", "Chile",
  "Dominican Rep.", "Venezuela", "Argentina", "Bolivia", "Trinidad and Tobago", "Falkland Is.",
  "Guyana", "Paraguay", "Uruguay", "Suriname", "Brazil", "Greenland",
  "Iceland", "Gambia", "Guinea-Bissau", "Senegal", "W. Sahara", "Sierra Leone",
  "Guinea", "Mauritania", "Liberia", "Morocco", "Portugal", "Ireland",
  "France", "Côte d'Ivoire", "Spain", "Mali", "United Kingdom", "Burkina Faso",
  "Ghana", "Togo", "Benin", "Algeria", "Belgium", "Netherlands",
  "Nigeria", "Switzerland", "Niger", "Tunisia", "Denmark", "Germany",
  "Eq. Guinea", "Gabon", "Italy", "Cameroon", "Norway", "Austria",
  "Slovenia", "Congo", "Czechia", "Sweden", "Croatia", "Namibia",
  "Angola", "Bosnia and Herz.", "Libya", "Chad", "Montenegro", "Hungary",
  "Poland", "Slovakia", "Albania", "Central African Rep.", "Serbia", "Kosovo",
  "Macedonia", "Greece", "Dem. Rep. Congo", "Botswana", "Lithuania", "Latvia",
  "Romania", "South Africa", "Bulgaria", "Estonia", "Finland", "Zambia",
  "Belarus", "Lesotho", "Moldova", "Zimbabwe", "Sudan", "Egypt",
  "Burundi", "Rwanda", "S. Sudan", "Ukraine", "eSwatini", "Uganda",
  "N. Cyprus", "Malawi", "Tanzania", "Israel", "Turkey", "Mozambique",
  "Lebanon", "Jordan", "Kenya", "Syria", "Eritrea", "Ethiopia",
  "Djibouti", "Georgia", "Iraq", "Saudi Arabia", "Armenia", "Somalia",
  "Somaliland", "Madagascar", "Yemen", "Azerbaijan", "Kuwait", "Qatar",
  "United Arab Emirates", "Iran", "Oman", "Turkmenistan", "Uzbekistan", "Afghanistan",
  "Kazakhstan", "Pakistan", "Fr. S. Antarctic Lands", "Tajikistan", "Kyrgyzstan", "India",
  "Sri Lanka", "Nepal", "Bangladesh", "Bhutan", "Russia", "Myanmar",
  "Thailand", "Mongolia", "China", "Laos", "Cambodia", "Vietnam",
  "Malaysia", "Brunei", "Indonesia", "Taiwan", "Philippines", "Timor-Leste",
  "North Korea", "South Korea", "Australia", "Japan", "Papua New Guinea", "Solomon Is.",
  "New Caledonia", "New Zealand", "Fiji",
];
export const countryKeyboardOrder = new Map(keyboardOrder.map((name, index) => [name, index]));
