const inExtension = !!globalThis.chrome?.runtime?.getURL;
// Canvas draws 200+ pins faster than SVG on phones; tolerance widens the tap target.
const map = L.map("map", { renderer: L.canvas({ tolerance: L.Browser.mobile ? 10 : 0 }) }).setView([52.0, 19.4], 6);

// Extension page: no tile server - OSM blocks extension pages (their usage policy needs
// a referer we can't send) and CARTO now wants an API key. The bundled country outlines
// (Natural Earth, public domain) need no network and can't break later.
// Web build (build_web.py): a normal site sends a referer, so it gets real OSM tiles;
// the outlines stay underneath as the offline fallback.
// ponytail: OSM's free tile server is for light use; switch to a keyed provider if traffic grows.
if (!inExtension) {
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}
map.createPane("outlines").style.zIndex = 150; // below tilePane (200)
map.attributionControl.addAttribution('tło: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
fetch(inExtension ? chrome.runtime.getURL("data/basemap.geojson") : "data/basemap.geojson")
  .then((r) => r.json())
  .then((geo) => {
    L.geoJSON(geo, {
      pane: "outlines",
      interactive: false,
      style: {
        color: "var(--kz-border)", weight: 1,
        fillColor: "var(--kz-land)", fillOpacity: 1,
      },
    }).addTo(map);
  })
  .catch(() => { document.getElementById("map-warning").hidden = false; });

// Phones: list and map each take the whole screen, toggled by these buttons.
const toList = document.getElementById("to-list");
L.DomEvent.disableClickPropagation(toList);
function showList(on) {
  document.body.classList.toggle("show-list", on);
  if (!on) map.invalidateSize();
}
toList.addEventListener("click", () => showList(true));
document.getElementById("to-map").addEventListener("click", () => showList(false));

const COLORS ={ positive: "#1e8e3e", mixed: "#e37400", negative: "#d93025" };
const layer = L.layerGroup().addTo(map);
const markers = new Map();

function marker(p) {
  const m = L.circleMarker([p.lat, p.lng], {
    radius: p.muala ? 10 : 7,
    color: p.muala ? "#c79100" : "#fff",
    weight: p.muala ? 3 : 1.5,
    fillColor: p.muala ? "#f5b700" : COLORS[p.overall],
    fillOpacity: 0.95,
  });
  m.bindPopup(`<div class="kz-root">${placeHtml(p, { showMapsLink: true })}</div>`, { maxWidth: 340, maxHeight: 420 });
  return m;
}

loadPlaces().then((places) => {
  setupList(places, {
    onChange: (shown) => {
      toList.textContent = `Lista (${shown.length})`;
      layer.clearLayers();
      markers.clear();
      for (const p of shown) {
        if (p.lat == null) continue;
        const m = marker(p);
        markers.set(p, m);
        layer.addLayer(m);
      }
      // Muala pins on top.
      markers.forEach((m, p) => p.muala && m.bringToFront());
    },
    onPick: (p) => {
      const m = markers.get(p);
      if (!m) return;
      showList(false);
      map.setView(m.getLatLng(), 15);
      m.openPopup();
    },
  });
});
