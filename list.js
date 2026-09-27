const map = L.map("map").setView([52.0, 19.4], 6);

// No tile server: OSM blocks extension pages (their usage policy needs a referer we
// can't send) and CARTO now wants an API key. The bundled country outlines
// (Natural Earth, public domain) need no network and can't break later.
map.attributionControl.addAttribution('tło: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
fetch(globalThis.chrome?.runtime?.getURL ? chrome.runtime.getURL("data/basemap.geojson") : "data/basemap.geojson")
  .then((r) => r.json())
  .then((geo) => {
    L.geoJSON(geo, {
      interactive: false,
      style: {
        color: "var(--kz-border)", weight: 1,
        fillColor: "var(--kz-land)", fillOpacity: 1,
      },
    }).addTo(map);
  })
  .catch(() => { document.getElementById("map-warning").hidden = false; });

const COLORS = { positive: "#1e8e3e", mixed: "#e37400", negative: "#d93025" };
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
      map.setView(m.getLatLng(), 15);
      m.openPopup();
    },
  });
});
