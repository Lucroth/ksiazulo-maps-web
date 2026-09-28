// HTML for one reviewed place. Used by content card, popup and list page.

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function fmtTime(url) {
  const t = +(new URL(url).searchParams.get("t") || 0);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(s).padStart(2, "0")}`;
}

// Polish plural: 1 miesiąc, 2-4 miesiące, 5+ miesięcy (12-14 take the "many" form).
function plPlural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

// "3 tygodnie temu", "5 miesięcy temu", "rok i 3 miesiące temu" for an ISO date.
function agoPl(iso, now = new Date()) {
  const then = new Date(iso + "T12:00:00");
  if (isNaN(then)) return "";
  const days = Math.floor((now - then) / 86400000);
  if (days < 1) return "dzisiaj";
  if (days < 2) return "wczoraj";
  if (days < 14) return `${days} dni temu`;
  if (days < 60) {
    const w = Math.floor(days / 7);
    return `${w} ${plPlural(w, "tydzień", "tygodnie", "tygodni")} temu`;
  }
  let months = (now.getFullYear() - then.getFullYear()) * 12 + now.getMonth() - then.getMonth();
  if (now.getDate() < then.getDate()) months--;
  const y = Math.floor(months / 12), m = months % 12;
  const mStr = m ? `${m === 1 ? "" : m + " "}${plPlural(m, "miesiąc", "miesiące", "miesięcy")}` : "";
  if (!y) return `${mStr} temu`;
  const yStr = y === 1 ? "rok" : `${y} ${plPlural(y, "rok", "lata", "lat")}`;
  return `${yStr}${m ? " i " + (m === 1 ? "1 miesiąc" : mStr) : ""} temu`;
}

const OVERALL = { positive: ["Poleca", "pos"], mixed: ["Tak sobie", "mix"], negative: ["Nie poleca", "neg"] };
const VERDICT = { "+": "pos", "~": "mix", "-": "neg" };

// --- Verdict filter: coloured toggle pills that are also the colour legend.
// Shared by popup, list page and the Maps chip panel, each remembering its own state.

const VERDICT_KEYS = ["positive", "mixed", "negative"];
const VERDICT_TIPS = {
  positive: "Książulo poleca to miejsce",
  mixed: "Werdykt mieszany: coś dobre, coś nie",
  negative: "Książulo nie poleca",
  muala: "Pokaż tylko miejsca z MUALĄ - jego specjalną rekomendacją (złoty, większy pin)",
};

function loadVerdictFilter() {
  const all = { positive: true, mixed: true, negative: true, muala: false };
  try {
    const s = { ...all, ...JSON.parse(localStorage.getItem("kz-verdicts") || "{}") };
    if (s.muala) s.positive = true;
    return s;
  } catch {
    return all;
  }
}

function saveVerdictFilter(state) {
  try {
    localStorage.setItem("kz-verdicts", JSON.stringify(state));
  } catch {}
}

function passesVerdict(p, state) {
  return state[p.overall] !== false && (!state.muala || p.muala);
}

// counts: places per verdict (and "muala") among those the other filters let through.
function verdictFilterHtml(state, counts) {
  const pill = (key, label, cls) => `
    <button type="button" class="kz-vpill ${cls}" data-key="${key}" aria-pressed="${!!state[key]}"
      title="${esc(VERDICT_TIPS[key])}">${cls === "gold" ? "" : '<span class="kz-dot"></span>'}${label}
      <span class="kz-vcount">${counts[key] ?? 0}</span></button>`;
  return VERDICT_KEYS.map((k) => pill(k, OVERALL[k][0], OVERALL[k][1])).join("")
    + pill("muala", "tylko MUALA", "gold");
}

// Wires the pills inside `container`; calls onToggle(newState) after each click.
function bindVerdictFilter(container, state, onToggle) {
  container.querySelectorAll(".kz-vpill").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = b.dataset.key;
      state[key] = !state[key];
      // Every MUALA is a "Poleca", so the two go together - otherwise the list ends up empty.
      if (key === "muala" && state.muala) state.positive = true;
      if (key === "positive" && !state.positive) state.muala = false;
      saveVerdictFilter(state);
      onToggle(state);
    }));
}

function verdictCounts(places) {
  const c = { positive: 0, mixed: 0, negative: 0, muala: 0 };
  for (const p of places) {
    c[p.overall] = (c[p.overall] || 0) + 1;
    if (p.muala) c.muala++;
  }
  return c;
}

function mapsUrl(p) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${p.name} ${p.address || p.city}`);
}

// showMapsLink: true opens a new tab, "here" navigates this tab (already on Maps).
function placeHtml(p, { full = true, unsure = false, showMapsLink = false } = {}) {
  const [label, cls] = OVERALL[p.overall] || ["?", "mix"];
  const latest = p.videos[0];
  const muala = p.muala
    ? `<a class="kz-muala" href="${esc(p.videos.find((v) => v.mualaUrl)?.mualaUrl || latest.url)}" target="_blank"
         title="${esc(p.mualaNote || "")}">MUALA</a>`
    : "";
  const dishes = full && p.dishes?.length
    ? `<details class="kz-dishes-box"><summary>Dania (${p.dishes.length})</summary>
       <ul class="kz-dishes">${p.dishes.map((d) => `<li><span class="kz-dot ${VERDICT[d.verdict] || "mix"}"></span>
         <b>${esc(d.name)}</b>${d.price ? ` <span class="kz-muted">${esc(d.price)}</span>` : ""}
         ${d.note ? ` <span class="kz-muted">- ${esc(d.note)}</span>` : ""}</li>`).join("")}</ul></details>`
    : "";
  // Several videos = he came back. Each line carries that visit's own verdict.
  const videos = p.videos.map((v, i) => `<a class="kz-video" href="${esc(v.url)}" target="_blank">
      ${p.videos.length > 1 ? `<span class="kz-dot ${OVERALL[v.overall]?.[1] || "mix"}"
        title="${esc(OVERALL[v.overall]?.[0] || "")}"></span>` : ""}▶ Oglądaj od ${fmtTime(v.url)}
      <span class="kz-muted">· ${esc(v.title)} · ${esc(v.date)} (${agoPl(v.date)})${i === 0 && p.videos.length > 1 ? " · najnowsza" : ""}</span></a>`).join("");
  return `
    <div class="kz-head">
      <span class="kz-brand">Książulo</span>
      <span class="kz-pill ${cls}">${label}</span>
      ${muala}
    </div>
    <div class="kz-name">${esc(p.name)} <span class="kz-muted">${esc(p.city)}</span></div>
    ${unsure ? `<div class="kz-warn">Możliwe dopasowanie - sprawdź adres: ${esc(p.address)}</div>` : ""}
    ${p.confidence === "low" ? `<div class="kz-warn">Niepewne dane - sprawdź w filmie.</div>` : ""}
    <p class="kz-summary">${esc(p.summary)}</p>
    ${p.muala && p.mualaNote ? `<p class="kz-muted kz-small">Muala: ${esc(p.mualaNote)}</p>` : ""}
    ${dishes}
    <div class="kz-videos">${videos}</div>
    ${showMapsLink ? `<a class="kz-video" href="${esc(mapsUrl(p))}"${showMapsLink === "here" ? "" : ' target="_blank"'}>📍 Otwórz w Mapach Google</a>` : ""}`;
}

async function loadPlaces() {
  // Outside the extension (served from a dev server) fall back to a relative path.
  const url = globalThis.chrome?.runtime?.getURL ? chrome.runtime.getURL("data/places.json") : "data/places.json";
  const res = await fetch(url);
  return res.json();
}
