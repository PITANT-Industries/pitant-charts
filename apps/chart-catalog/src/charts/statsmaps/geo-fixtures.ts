export type Coordinate = [number, number];

export interface Marker {
  at: Coordinate;
  label: string;
  value: number;
  category: string;
}

export interface Route {
  from: Coordinate;
  to: Coordinate;
  label: string;
  value: number;
  category: string;
  fromName?: string;
  toName?: string;
}

type Place = [name: string, longitude: number, latitude: number, value: number, category?: string];
const usage: Place[] = [
  ["New York", -74, 40.71, 184200], ["London", -.13, 51.5, 158700], ["San Francisco", -122.42, 37.77, 126400],
  ["Los Angeles", -118.24, 34.05, 88900], ["Paris", 2.35, 48.85, 84500], ["Tokyo", 139.7, 35.7, 82000],
  ["Berlin", 13.4, 52.5, 78100], ["Toronto", -79.38, 43.65, 72700], ["Chicago", -87.63, 41.88, 69400],
  ["Sydney", 151.21, -33.87, 66100], ["Singapore", 103.82, 1.3, 63400], ["São Paulo", -46.63, -23.55, 59700],
  ["Amsterdam", 4.9, 52.37, 59700], ["Seattle", -122.33, 47.61, 58100], ["Madrid", -3.7, 40.42, 59500],
  ["Bengaluru", 77.59, 12.97, 58300], ["Boston", -71.06, 42.36, 55600], ["Seoul", 127, 37.6, 52400],
  ["Melbourne", 144.96, -37.81, 46700], ["Dubai", 55.27, 25.2, 43700], ["Mumbai", 72.88, 19.08, 40800],
  ["Mexico City", -99.13, 19.43, 38500], ["Dublin", -6.26, 53.35, 36900], ["Stockholm", 18.07, 59.33, 34100],
  ["Jakarta", 106.85, -6.2, 30800], ["Cape Town", 18.43, -33.92, 28400], ["Lisbon", -9.14, 38.72, 27300],
  ["Nairobi", 36.82, -1.29, 25300], ["Warsaw", 21.01, 52.23, 21700], ["Buenos Aires", -58.38, -34.60, 11900],
];
const offices: Place[] = [
  ["San Francisco", -122.42, 37.77, 420, "Americas"], ["Austin", -97.74, 30.27, 140, "Americas"],
  ["New York", -74, 40.71, 215, "Americas"], ["Toronto", -79.38, 43.65, 110, "Americas"], ["São Paulo", -46.63, -23.55, 70, "Americas"],
  ["London", -.13, 51.5, 310, "EMEA"], ["Berlin", 13.4, 52.5, 250, "EMEA"], ["Dublin", -6.26, 53.35, 125, "EMEA"],
  ["Warsaw", 21.01, 52.23, 132, "EMEA"], ["Cape Town", 18.43, -33.92, 26, "EMEA"],
  ["Bengaluru", 77.59, 12.97, 280, "APAC"], ["Singapore", 103.82, 1.3, 166, "APAC"],
  ["Sydney", 151.21, -33.87, 110, "APAC"], ["Tokyo", 139.7, 35.7, 86, "APAC"],
];
const europe: Place[] = [
  ["London", -.13, 51.5, 18420], ["Dublin", -6.26, 53.35, 3870], ["Paris", 2.35, 48.85, 12960],
  ["Berlin", 13.4, 52.5, 11380], ["Amsterdam", 4.9, 52.37, 9480], ["Madrid", -3.7, 40.42, 8130],
  ["Rome", 12.5, 41.9, 7520], ["Stockholm", 18.07, 59.33, 5930], ["Oslo", 10.75, 59.91, 4940],
  ["Vienna", 16.37, 48.2, 4840], ["Prague", 14.42, 50.08, 4520], ["Lisbon", -9.14, 38.72, 4190],
  ["Warsaw", 21.01, 52.23, 4110], ["Copenhagen", 12.57, 55.68, 3890], ["Brussels", 4.35, 50.85, 3590],
  ["Zurich", 8.54, 47.37, 3350], ["Budapest", 19.04, 47.5, 3190], ["Athens", 23.73, 37.98, 2770],
  ["Helsinki", 24.94, 60.17, 2650], ["Bucharest", 26.1, 44.43, 2140],
];
const cloud: Place[] = [
  ["eu-central (Frankfurt)", 8.68, 50.11, 1], ["us-east (Virginia)", -77.47, 39.04, 1], ["us-west (Oregon)", -122.67, 45.52, 1],
  ["us-west (California)", -121.89, 37.34, 1], ["ca-central (Toronto)", -79.38, 43.65, 1], ["sa-east (São Paulo)", -46.63, -23.55, 1],
  ["eu-west (Dublin)", -6.26, 53.35, 1], ["eu-west (London)", -.13, 51.5, 1], ["eu-north (Stockholm)", 18.07, 59.33, 1],
  ["af-south (Cape Town)", 18.43, -33.92, 1], ["me-central (Dubai)", 55.27, 25.2, 1], ["ap-south (Mumbai)", 72.88, 19.08, 1],
  ["ap-southeast (Singapore)", 103.82, 1.3, 1], ["ap-northeast (Tokyo)", 139.7, 35.7, 1],
  ["ap-southeast (Sydney)", 151.21, -33.87, 1], ["ap-northeast (Seoul)", 127, 37.6, 1],
];
const customers: Place[] = [
  ["United States", -98.58, 39.83, 4820], ["Canada", -106.34, 56.13, 1430], ["Mexico", -102.55, 23.63, 870],
  ["Brazil", -51.92, -14.24, 860], ["Argentina", -63.62, -38.42, 420], ["United Kingdom", -.13, 51.5, 2150],
  ["Germany", 10.45, 51.16, 1730], ["France", 2.35, 48.85, 1340], ["Spain", -3.7, 40.42, 910],
  ["Netherlands", 4.9, 52.37, 720], ["Sweden", 18.07, 59.33, 640], ["Portugal", -9.14, 38.72, 580], ["Colombia", -74.07, 4.71, 300],
];

export function mapFixtures(id: string): Marker[] {
  const places = id === "bubble-map-categories" ? offices : id === "bubble-map-region" ? europe : id === "bubble-map-loading" ? usage.slice(0, 15)
    : id === "globe-sized" ? customers : id === "globe-loading" ? cloud.slice(0, 10) : id === "globe-default" ? cloud : usage;
  return places.map(([label, longitude, latitude, value, category]) => ({ at: [longitude, latitude], label, value, category: category ?? "Places" }));
}

const airports: Record<string, Coordinate> = {
  London: [-.45, 51.47], "New York": [-73.78, 40.64], "Mexico City": [-99.07, 19.44], Toronto: [-79.63, 43.68],
  "São Paulo": [-46.47, -23.43], "Los Angeles": [-118.41, 33.94], Johannesburg: [28.24, -26.13], Dubai: [55.36, 25.25],
  Singapore: [103.99, 1.36], Mumbai: [72.87, 19.09], Tokyo: [140.39, 35.77], Sydney: [151.17, -33.94], Seoul: [126.44, 37.46],
  "San Francisco": [-122.38, 37.62], Seattle: [-122.31, 47.45], Chicago: [-87.9, 41.98], Atlanta: [-84.43, 33.64],
  Denver: [-104.67, 39.86], Miami: [-80.29, 25.8], Boston: [-71.01, 42.37], Dallas: [-97.04, 32.9],
  "Las Vegas": [-115.15, 36.08], Phoenix: [-112.01, 33.43],
};
type Flight = [from: string, to: string, traffic: number, airline?: string];
const globalFlights: Flight[] = [
  ["London", "New York", 9800], ["New York", "Mexico City", 4200], ["London", "Toronto", 5600],
  ["London", "Johannesburg", 2600], ["London", "Dubai", 5100], ["Dubai", "Johannesburg", 2900],
  ["Dubai", "Mumbai", 7200], ["Dubai", "Singapore", 5600], ["Singapore", "Sydney", 4200], ["Singapore", "Tokyo", 4100],
  ["Singapore", "Seoul", 4000], ["Tokyo", "Los Angeles", 5900], ["Tokyo", "New York", 3900], ["Tokyo", "Sydney", 3300],
  ["New York", "São Paulo", 3500], ["New York", "Los Angeles", 5100], ["Dubai", "São Paulo", 1200], ["London", "Singapore", 4800],
];
const usFlights: Flight[] = [
  ["San Francisco", "Seattle", 14, "Northwind"], ["Denver", "San Francisco", 21, "Northwind"], ["Denver", "Seattle", 21, "Northwind"],
  ["Denver", "Las Vegas", 14, "Northwind"], ["Denver", "Phoenix", 21, "Northwind"],
  ["Chicago", "New York", 34, "Lakeline"], ["Chicago", "Boston", 28, "Lakeline"], ["Chicago", "Denver", 28, "Lakeline"],
  ["Chicago", "Dallas", 21, "Lakeline"], ["Chicago", "Los Angeles", 28, "Lakeline"],
  ["Atlanta", "New York", 42, "Sunrise"], ["Atlanta", "Miami", 35, "Sunrise"], ["Atlanta", "Boston", 28, "Sunrise"],
  ["Atlanta", "Chicago", 28, "Sunrise"], ["Atlanta", "Dallas", 21, "Sunrise"],
];

export function routeFixtures(id: string): Route[] {
  const flights = id === "route-map-region" ? usFlights : id === "route-map-loading" ? [
    ...globalFlights.slice(0, 9), ["London", "Singapore", 4100] as Flight,
  ] : globalFlights;
  return flights.map(([fromName, toName, value, airline]) => ({
    from: airports[fromName], to: airports[toName], label: `${fromName} → ${toName}`, value, category: airline ?? "Routes", fromName, toName,
  }));
}
