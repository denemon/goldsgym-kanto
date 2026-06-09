// ゴールドジム 15分圏マップ
// 選択した店舗から「15分 × 移動速度」を半径にした円（バッファ）を描画。
// ※ 直線距離ベースの概算。実際の道路・地形は考慮しない。

const PREF_ORDER = ["東京都", "神奈川県", "千葉県", "埼玉県"];
const DATA_PATH = "assets/data/gyms.json";
const DATA_FALLBACK_URL = "https://denemon.github.io/goldsgym-kanto/assets/data/gyms.json";

// 15分あたりの移動速度（m/分）→ 半径(m)
const MODES = {
  walk: { label: "徒歩", mpm: 80 },   // 1200m
  bike: { label: "自転車", mpm: 233 }, // 約3500m
  car:  { label: "車", mpm: 333 },     // 約5000m
};
const MINUTES = 15;

let allGyms = [];
let activeMode = "walk";
let showAll = false;
let selectedName = null;

const zoneLayer = L.layerGroup();
const markerLayer = L.layerGroup();

const map = L.map("map", { zoomControl: true }).setView([35.7, 139.7], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
zoneLayer.addTo(map);
markerLayer.addTo(map);

function radiusM() {
  return MODES[activeMode].mpm * MINUTES;
}

function goldIcon(open24h) {
  return L.divIcon({
    className: "",
    html: `<div class="gold-pin ${open24h ? "is-24h" : ""}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

function drawCircle(g, isFocus) {
  const c = L.circle([g.lat, g.lng], {
    radius: radiusM(),
    className: "zone-circle",
    interactive: false,
  });
  c.addTo(zoneLayer);
  const m = L.marker([g.lat, g.lng], { icon: goldIcon(g.open24h) }).bindPopup(
    `<div class="popup-title">ゴールドジム${g.name}</div>
     <div class="popup-station">🚉 ${g.station}</div>
     <div class="popup-addr">${MODES[activeMode].label}${MINUTES}分圏 ≒ 半径${(radiusM() / 1000).toFixed(1)}km</div>`
  );
  m.addTo(markerLayer);
  if (isFocus) m.openPopup();
  return c;
}

function render() {
  zoneLayer.clearLayers();
  markerLayer.clearLayers();

  if (showAll) {
    allGyms.forEach((g) => drawCircle(g, false));
    if (allGyms.length) map.fitBounds(L.latLngBounds(allGyms.map((g) => [g.lat, g.lng])), { padding: [30, 30] });
    return;
  }

  const g = allGyms.find((x) => x.name === selectedName) || allGyms[0];
  if (!g) return;
  const c = drawCircle(g, true);
  map.fitBounds(c.getBounds(), { padding: [40, 40] });
}

function renderModeTabs() {
  const tabs = document.getElementById("mode-tabs");
  tabs.innerHTML = Object.entries(MODES)
    .map(
      ([key, m]) =>
        `<button class="pref-tab ${key === activeMode ? "active" : ""}" data-mode="${key}">${m.label}<span>${(m.mpm * MINUTES / 1000).toFixed(1)}km</span></button>`
    )
    .join("");
  tabs.querySelectorAll(".pref-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeMode = btn.dataset.mode;
      renderModeTabs();
      render();
    })
  );
}

function populateSelect() {
  const sel = document.getElementById("store-select");
  let html = "";
  PREF_ORDER.forEach((pref) => {
    const group = allGyms.filter((g) => g.pref === pref);
    if (!group.length) return;
    html += `<optgroup label="${pref}">`;
    group.forEach((g) => {
      html += `<option value="${g.name}">${g.name}（${g.station}）</option>`;
    });
    html += `</optgroup>`;
  });
  sel.innerHTML = html;
  selectedName = allGyms[0]?.name || null;
  sel.value = selectedName;
  sel.addEventListener("change", () => {
    selectedName = sel.value;
    document.getElementById("show-all").checked = false;
    showAll = false;
    render();
  });
}

// SVGの放射状グラデーション定義を注入（黄色グラデのゾーン用）
function injectGradient() {
  const svg = map.getPanes().overlayPane.querySelector("svg");
  if (!svg || svg.querySelector("#zoneGrad")) return;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <radialGradient id="zoneGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff4c2" stop-opacity="0.15"/>
      <stop offset="60%" stop-color="#ffd23f" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#f5a800" stop-opacity="0.65"/>
    </radialGradient>`;
  svg.insertBefore(defs, svg.firstChild);
}

async function loadGymData() {
  const urls = [...new Set([DATA_PATH, new URL(DATA_PATH, document.baseURI).href, DATA_FALLBACK_URL])];
  let lastError;

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);

      const data = await res.json();
      if (!Array.isArray(data.gyms) || data.gyms.length === 0) {
        throw new Error(`Invalid gyms data: ${url}`);
      }
      return data.gyms;
    } catch (e) {
      lastError = e;
      console.warn("店舗データの読み込みを再試行します:", e);
    }
  }

  throw lastError || new Error("店舗データの読み込みに失敗しました。");
}

async function init() {
  try {
    const gyms = await loadGymData();
    allGyms = gyms.slice().sort((a, b) => PREF_ORDER.indexOf(a.pref) - PREF_ORDER.indexOf(b.pref));

    populateSelect();
    renderModeTabs();
    render();
    injectGradient();

    document.getElementById("show-all").addEventListener("change", (e) => {
      showAll = e.target.checked;
      document.getElementById("store-select").disabled = showAll; // 全店表示中は店舗選択を無効化
      render();
      injectGradient();
    });
  } catch (e) {
    console.error(e);
    alert("データの読み込みに失敗しました。簡易サーバー経由で開いてください。");
  }
}

init();
