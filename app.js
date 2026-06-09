// ゴールドジム MAP（東京・神奈川・千葉・埼玉）
// gyms.json を読み込み → Leaflet地図にマーカー描画 + サイドバー一覧 + 絞り込み

const PREF_ORDER = ["東京都", "神奈川県", "千葉県", "埼玉県"];
const markers = new Map(); // gym.name -> Leaflet marker
let allGyms = [];
let activePref = "all";

const map = L.map("map", { zoomControl: true }).setView([35.7, 139.8], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

function goldIcon(open24h) {
  return L.divIcon({
    className: "",
    html: `<div class="gold-pin ${open24h ? "is-24h" : ""}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

function popupHtml(g) {
  const q = encodeURIComponent(`ゴールドジム${g.name} ${g.address}`);
  return `
    <div class="popup-title">ゴールドジム${g.name}${g.open24h ? ' <span class="badge-24h">24h</span>' : ""}</div>
    <div class="popup-station">🚉 ${g.station}</div>
    <div class="popup-addr">〒${g.zip}<br>${g.address}</div>
    <a class="popup-link" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Googleマップで開く ↗</a>
  `;
}

function buildMarkers(gyms) {
  gyms.forEach((g) => {
    const m = L.marker([g.lat, g.lng], { icon: goldIcon(g.open24h) }).bindPopup(popupHtml(g));
    m.addTo(map);
    markers.set(g.name, m);
  });
}

function focusGym(g) {
  map.flyTo([g.lat, g.lng], 16, { duration: 0.6 });
  const m = markers.get(g.name);
  if (m) m.openPopup();
}

function fitTo(gyms) {
  if (!gyms.length) return;
  const bounds = L.latLngBounds(gyms.map((g) => [g.lat, g.lng]));
  map.fitBounds(bounds, { padding: [40, 40] });
}

function renderPrefTabs() {
  const tabs = document.getElementById("pref-tabs");
  const counts = {};
  allGyms.forEach((g) => (counts[g.pref] = (counts[g.pref] || 0) + 1));
  const items = [["all", "すべて", allGyms.length], ...PREF_ORDER.map((p) => [p, p, counts[p] || 0])];
  tabs.innerHTML = items
    .map(
      ([key, label, n]) =>
        `<button class="pref-tab ${key === activePref ? "active" : ""}" data-pref="${key}">${label}<span>${n}</span></button>`
    )
    .join("");
  tabs.querySelectorAll(".pref-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      activePref = btn.dataset.pref;
      renderPrefTabs();
      applyFilters(true);
    })
  );
}

function renderList(gyms) {
  const list = document.getElementById("gym-list");
  document.getElementById("count").textContent = gyms.length;
  list.innerHTML = "";

  let currentPref = null;
  gyms.forEach((g) => {
    if (g.pref !== currentPref) {
      currentPref = g.pref;
      const head = document.createElement("li");
      head.className = "group-head";
      head.textContent = currentPref;
      list.appendChild(head);
    }
    const li = document.createElement("li");
    li.className = "gym-item";
    li.innerHTML = `
      <div class="name">${g.name}${g.open24h ? '<span class="badge-24h">24h</span>' : ""}</div>
      <div class="station">🚉 ${g.station}</div>
      <div class="addr">${g.ward} / ${g.address}</div>`;
    li.addEventListener("click", () => {
      document.querySelectorAll(".gym-item.active").forEach((e) => e.classList.remove("active"));
      li.classList.add("active");
      focusGym(g);
    });
    list.appendChild(li);
  });
}

function applyFilters(fit = false) {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const only24h = document.getElementById("filter24h").checked;

  const filtered = allGyms.filter((g) => {
    if (activePref !== "all" && g.pref !== activePref) return false;
    if (only24h && !g.open24h) return false;
    if (!q) return true;
    return [g.name, g.ward, g.address, g.pref, g.station].join(" ").toLowerCase().includes(q);
  });

  const visible = new Set(filtered.map((g) => g.name));
  markers.forEach((m, name) => {
    if (visible.has(name)) m.addTo(map);
    else map.removeLayer(m);
  });

  renderList(filtered);
  if (fit) fitTo(filtered); // 検索入力では地図を動かさない（都県切替・24hフィルタ時のみフィット）
}

async function init() {
  try {
    const res = await fetch("gyms.json");
    const data = await res.json();
    // 都県順 → その中は元の並びを維持
    allGyms = data.gyms.slice().sort((a, b) => PREF_ORDER.indexOf(a.pref) - PREF_ORDER.indexOf(b.pref));
    buildMarkers(allGyms);
    renderPrefTabs();
    renderList(allGyms);

    document.getElementById("search").addEventListener("input", () => applyFilters(false));
    document.getElementById("filter24h").addEventListener("change", () => applyFilters(true));
  } catch (e) {
    document.getElementById("gym-list").innerHTML =
      '<li class="gym-item">データの読み込みに失敗しました。ローカルで開く場合は簡易サーバー経由で表示してください。</li>';
    console.error(e);
  }
}

init();
