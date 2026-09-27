// Search + filters shared by popup and full list page.

function setupList(places, { onChange, onPick }) {
  const $ = (id) => document.getElementById(id);
  const cities = [...new Set(places.map((p) => p.city))].sort((a, b) => a.localeCompare(b, "pl"));
  $("f-city").innerHTML += cities.map((c) => `<option>${esc(c)}</option>`).join("");

  const haystack = (p) => normName([p.name, p.city, p.address, ...p.dishes.map((d) => d.name)].join(" "));
  const verdicts = loadVerdictFilter();

  function apply() {
    const q = normName($("q").value);
    // Pill counts follow the search and city, so each pill says how many it would show.
    const matching = places.filter((p) =>
      (!q || haystack(p).includes(q)) &&
      (!$("f-city").value || p.city === $("f-city").value));
    const shown = matching.filter((p) => passesVerdict(p, verdicts));
    $("f-verdicts").innerHTML = verdictFilterHtml(verdicts, verdictCounts(matching));
    bindVerdictFilter($("f-verdicts"), verdicts, apply);
    const mualas = shown.filter((p) => p.muala).length;
    $("count").textContent = `${shown.length} miejsc · ${mualas} z MUALĄ`;
    $("list").innerHTML = shown.map((p, i) => `
      <li data-i="${i}">
        <div class="row-head">
          <span class="kz-dot ${VERDICT[{ positive: "+", mixed: "~", negative: "-" }[p.overall]]}"></span>
          <b>${esc(p.name)}</b> <span class="kz-muted">${esc(p.city)}</span>
          ${p.muala ? '<span class="kz-muala">MUALA</span>' : ""}
        </div>
        <div class="kz-muted kz-small">${esc(p.videos[0].date)} · ${esc(p.summary.slice(0, 110))}${p.summary.length > 110 ? "…" : ""}</div>
      </li>`).join("");
    $("list").querySelectorAll("li").forEach((li) =>
      li.addEventListener("click", () => onPick(shown[+li.dataset.i], li)));
    onChange?.(shown);
  }
  ["q", "f-city"].forEach((id) => $(id).addEventListener("input", apply));
  apply();
}
