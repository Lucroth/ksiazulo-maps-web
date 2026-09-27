// Matching a Google Maps place (name + coords) to a reviewed place.
// Shared by content script, popup and list page.

const GENERIC_WORDS = new Set([
  "restauracja", "restaurant", "restauracji", "bar", "bistro", "pizzeria", "kawiarnia", "cafe", "caffe",
  "pub", "trattoria", "karczma", "gospoda", "bufet", "food", "truck", "kuchnia", "the", "i", "w", "na",
]);

// Must stay in sync with norm() in pipeline/build.py.
function normName(s) {
  return (s || "")
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Name words minus generic ones ("restauracja", "bar") and the city ("Viral Kebab Katowice").
function nameTokens(s, city) {
  const all = normName(s).split(" ").filter(Boolean);
  const skip = new Set([...GENERIC_WORDS, ...normName(city).split(" ").filter(Boolean)]);
  const core = all.filter((t) => !skip.has(t));
  return core.length ? core : all;
}

// 0..1 similarity of two place names; whole words only, so "baba" never matches "babalu".
function nameScore(a, b, city = "") {
  const ta = nameTokens(a, city), tb = nameTokens(b, city);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;
  // All words of a multi-word name appear in the other ("Kura Gemüse" vs "Kura Gemüse Kebab").
  // Single-word names don't qualify: "Aurora" is not "Hotel Aurora".
  const sa = new Set(ta), sb = new Set(tb);
  const subset = (x, ys) => x.length >= 2 && x.every((t) => ys.has(t));
  if (subset(ta, sb) || subset(tb, sa)) return 0.9;
  const inter = ta.filter((t) => sb.has(t)).length;
  return inter / new Set([...ta, ...tb]).size;
}

function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Coordinates of the opened place from a Maps URL.
// "!3d<lat>!4d<lng>" is the pin itself; "@lat,lng" is only the viewport centre.
function coordsFromUrl(url) {
  const pins = [...url.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)];
  if (pins.length) {
    const m = pins[pins.length - 1];
    return { lat: +m[1], lng: +m[2], exact: true };
  }
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return at ? { lat: +at[1], lng: +at[2], exact: false } : null;
}

// Returns { place, sure } or null.
function findPlace(places, name, coords) {
  let best = null;
  for (const p of places) {
    const score = nameScore(name, p.name, p.city);
    if (score < 0.5) continue;
    const d = coords && p.lat != null ? distanceM(coords.lat, coords.lng, p.lat, p.lng) : Infinity;
    const near = coords ? (coords.exact ? 300 : 1500) : 0;
    let rank;
    if (d <= near) rank = 2 + score;               // close by and similar name
    else if (score >= 0.9 && d <= 3000) rank = 1 + score; // geocode may be off a bit
    else if (score === 1 && !coords) rank = score;   // no location to compare
    else continue;
    // Half-matching names ("Hotel Aurora" vs "Aurora") still show, flagged as a possible match.
    if (!best || rank > best.rank) best = { place: p, rank, sure: rank >= 2 && score >= 0.6 };
  }
  return best;
}
