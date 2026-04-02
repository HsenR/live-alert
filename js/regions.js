/** Bounding boxes [west, south, east, north] and map view */
export const REGIONS = {
  israel: {
    id: "israel",
    bbox: [34.25, 29.45, 35.95, 33.45],
    center: [31.5, 35.0],
    zoom: 8,
    /** Keywords to match UN / text feeds to this country (lowercase) */
    keywords: ["israel", "gaza", "palestin", "tel aviv", "jerusalem", "occupied palestinian", "west bank"],
  },
  lebanon: {
    id: "lebanon",
    bbox: [35.05, 33.02, 36.65, 34.72],
    center: [33.9, 35.85],
    zoom: 8,
    keywords: ["lebanon", "beirut", "tripoli", "tyre", "sidon", "unifil", "blue line"],
  },
  iran: {
    id: "iran",
    bbox: [44.0, 25.0, 63.5, 39.8],
    center: [32.5, 53.5],
    zoom: 5,
    keywords: ["iran", "tehran", "isfahan", "mashhad", "persian gulf", "islamic republic of iran"],
  },
};

/**
 * @param {[number, number]} lngLat
 * @param {[number, number, number, number]} bbox
 */
export function pointInBbox(lngLat, bbox) {
  const [lng, lat] = lngLat;
  const [w, s, e, n] = bbox;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

/**
 * @param {string} text
 * @param {string[]} keywords
 */
export function textMatchesKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}
