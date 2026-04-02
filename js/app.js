import { applyI18n, t } from "./i18n.js";
import { REGIONS, pointInBbox, textMatchesKeywords } from "./regions.js";

const POLL_MS = 90_000;
const GDACS_TYPES = ["EQ", "FL", "TC", "DR", "VO"];

let lang = localStorage.getItem("live-map-lang") || "en";
let country = /** @type {"israel"|"lebanon"|"iran"} */ (
  localStorage.getItem("live-map-country") || "israel"
);

/** @type {import("leaflet").Map | null} */
let map = null;
/** @type {import("leaflet").LayerGroup | null} */
let gdacsLayer = null;
/** @type {import("leaflet").LayerGroup | null} */
let usgsLayer = null;
/** @type {import("leaflet").LayerGroup | null} */
let feedLayer = null;

/** @type {Set<string>} */
let previousAlertIds = new Set();
/** After country change, skip one diff cycle to avoid false “new” alerts. */
let alertsInitialized = false;

/** @type {boolean} */
let notifyEnabled = false;

function region() {
  return REGIONS[country];
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function initMap() {
  const r = region();
  map = L.map("map", { scrollWheelZoom: true, worldCopyJump: true }).setView(r.center, r.zoom);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  gdacsLayer = L.layerGroup().addTo(map);
  usgsLayer = L.layerGroup().addTo(map);
  feedLayer = L.layerGroup().addTo(map);

  map.fitBounds(
    [
      [r.bbox[1], r.bbox[0]],
      [r.bbox[3], r.bbox[2]],
    ],
    { padding: [24, 24] }
  );
}

function setCountry(next) {
  country = next;
  localStorage.setItem("live-map-country", country);
  alertsInitialized = false;
  document.querySelectorAll(".country-tabs .tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-country") === country);
  });
  const r = region();
  if (map) {
    map.fitBounds(
      [
        [r.bbox[1], r.bbox[0]],
        [r.bbox[3], r.bbox[2]],
      ],
      { padding: [24, 24] }
    );
  }
  renderAlerts(lastFeedPayload);
  updateLegend();
}

function setLang(next) {
  lang = next;
  localStorage.setItem("live-map-lang", lang);
  document.querySelectorAll(".btn-lang").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
  });
  applyI18n(lang);
  updateLegend();
  renderAlerts(lastFeedPayload);
}

function updateLegend() {
  const el = document.getElementById("map-legend");
  if (!el) return;
  el.innerHTML = `
    <strong>${t(lang, "legendTitle")}</strong>
    <div>● ${t(lang, "legendGdacs")}</div>
    <div>● ${t(lang, "legendUsgs")}</div>
    <div>● ${t(lang, "legendFeed")}</div>
  `;
}

/**
 * @param {string} fromDate
 * @param {string} toDate
 */
async function fetchGdacsRange(fromDate, toDate) {
  const urls = GDACS_TYPES.map(
    (et) =>
      `https://www.gdacs.org/gdacsapi/api/Events/geteventlist/SEARCH?fromDate=${fromDate}&toDate=${toDate}&eventtype=${et}`
  );
  const results = await Promise.allSettled(urls.map((u) => fetch(u).then((r) => r.json())));
  /** @type {GeoJSON.Feature[]} */
  const features = [];
  const seen = new Set();
  for (const res of results) {
    if (res.status !== "fulfilled" || !res.value?.features) continue;
    for (const f of res.value.features) {
      const p = f.properties || {};
      const key = `${p.eventtype || ""}-${p.eventid || ""}-${p.episodeid || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push(f);
    }
  }
  return { type: "FeatureCollection", features };
}

async function fetchUsgs() {
  const u = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson";
  const r = await fetch(u);
  return r.json();
}

/** @type {any} */
let lastFeedPayload = null;

/**
 * @param {any} payload
 * @param {"israel"|"lebanon"|"iran"} c
 */
function filterAlertsForCountry(payload, c) {
  const r = REGIONS[c];
  const raw = payload?.alerts || [];
  return raw.filter((a) => {
    if (a.country && a.country === c) return true;
    if (a.lat != null && a.lng != null) {
      const lng = Number(a.lng);
      const lat = Number(a.lat);
      if (Number.isFinite(lng) && Number.isFinite(lat) && pointInBbox([lng, lat], r.bbox)) return true;
    }
    const blob = `${a.title || ""} ${a.summary || ""}`;
    return textMatchesKeywords(blob, r.keywords);
  });
}

async function fetchLiveJson() {
  const r = await fetch(`data/live.json?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) throw new Error("live.json");
  return r.json();
}

/**
 * @param {GeoJSON.FeatureCollection} fc
 */
function renderGdacsOnMap(fc) {
  if (!gdacsLayer || !map) return;
  gdacsLayer.clearLayers();
  const r = region();
  const enabled = document.getElementById("layer-gdacs")?.checked;
  if (!enabled) return;

  for (const f of fc.features || []) {
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const [lng, lat] = g.coordinates;
    if (!pointInBbox([lng, lat], r.bbox)) continue;
    const p = f.properties || {};
    const title = p.name || p.eventname || "GDACS";
    const level = p.alertlevel || "";
    const marker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#3db8a6",
      weight: 2,
      fillColor: "#1a3d36",
      fillOpacity: 0.85,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(title)}</strong><br/><span>${escapeHtml(level)}</span><br/><a href="${p.url?.report || "https://www.gdacs.org/"}" target="_blank" rel="noopener">GDACS</a>`
    );
    marker.addTo(gdacsLayer);
  }
}

/**
 * @param {GeoJSON.FeatureCollection} fc
 */
function renderUsgsOnMap(fc) {
  if (!usgsLayer || !map) return;
  usgsLayer.clearLayers();
  const r = region();
  const enabled = document.getElementById("layer-usgs")?.checked;
  if (!enabled) return;

  for (const f of fc.features || []) {
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const [lng, lat] = g.coordinates;
    if (!pointInBbox([lng, lat], r.bbox)) continue;
    const p = f.properties || {};
    const mag = p.mag ?? "";
    const place = p.place ?? "";
    const marker = L.circleMarker([lat, lng], {
      radius: 5 + Math.min(6, Number(mag) || 0),
      color: "#e8a23c",
      weight: 2,
      fillColor: "#3d2a12",
      fillOpacity: 0.9,
    });
    const url = p.url || "https://earthquake.usgs.gov/";
    marker.bindPopup(
      `<strong>M ${escapeHtml(String(mag))}</strong><br/>${escapeHtml(place)}<br/><a href="${url}" target="_blank" rel="noopener">USGS</a>`
    );
    marker.addTo(usgsLayer);
  }
}

/**
 * @param {any[]} alerts
 */
function renderFeedPointsOnMap(alerts) {
  if (!feedLayer || !map) return;
  feedLayer.clearLayers();
  const r = region();
  const enabled = document.getElementById("layer-feed")?.checked;
  if (!enabled) return;

  for (const a of alerts) {
    if (a.country && a.country !== country) continue;
    const lng = Number(a.lng);
    const lat = Number(a.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!pointInBbox([lng, lat], r.bbox)) continue;
    const marker = L.circleMarker([lat, lng], {
      radius: 6,
      color: "#7c9ef0",
      weight: 2,
      fillColor: "#1e2a4a",
      fillOpacity: 0.9,
    });
    const link = a.url ? `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">link</a>` : "";
    marker.bindPopup(`<strong>${escapeHtml(a.title || "")}</strong><br/>${link}`);
    marker.addTo(feedLayer);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} body
 */
function pushNotification(id, title, body) {
  if (!notifyEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body: body.slice(0, 200), tag: id });
  } catch {
    /* ignore */
  }
}

/**
 * @param {any} payload
 */
function renderAlerts(payload) {
  const list = document.getElementById("alert-list");
  const empty = document.getElementById("empty-alerts");
  const syncTime = document.getElementById("sync-time");
  if (!list || !syncTime) return;

  const filtered = filterAlertsForCountry(payload, country);

  filtered.sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")));

  const currentIds = new Set(
    filtered.map((a) => String(a.id || `${a.source}|${a.title}|${a.published}`))
  );
  if (alertsInitialized && notifyEnabled) {
    for (const id of currentIds) {
      if (!previousAlertIds.has(id)) {
        const item = filtered.find(
          (x) => String(x.id || `${x.source}|${x.title}|${x.published}`) === id
        );
        if (item) {
          pushNotification(id, item.title || "Update", item.summary || "");
        }
      }
    }
  }
  previousAlertIds = currentIds;
  alertsInitialized = true;

  list.innerHTML = "";
  for (const a of filtered.slice(0, 40)) {
    const id = a.id || `${a.source}|${a.title}|${a.published}`;

    const li = document.createElement("li");
    li.className = "alert-item";
    const src = (a.source || "feed").toLowerCase();
    const pillClass = src.includes("oref") ? "oref" : src.includes("un") ? "un" : src.includes("gdacs") ? "gdacs" : src.includes("usgs") ? "usgs" : "";
    const link = a.url
      ? `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${lang === "ar" ? "افتح المصدر" : "Open source"}</a>`
      : "";
    li.innerHTML = `
      <h3>${escapeHtml(a.title || "")}</h3>
      <p>${escapeHtml((a.summary || "").slice(0, 280))}${(a.summary || "").length > 280 ? "…" : ""}</p>
      <div class="alert-meta">
        <span class="pill ${pillClass}">${escapeHtml(a.source || "feed")}</span>
        <span class="pill">${escapeHtml(fmtTime(a.published))}</span>
      </div>
      ${link ? `<div class="alert-meta">${link}</div>` : ""}
    `;
    list.appendChild(li);
  }

  empty.hidden = filtered.length > 0;
  syncTime.textContent = fmtTime(payload?.fetchedAt);
  renderFeedPointsOnMap(filtered);
}

async function refreshRemoteLayers() {
  const status = document.getElementById("live-status");
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  try {
    const [gdacs, usgs, live] = await Promise.all([
      fetchGdacsRange(isoDate(from), isoDate(to)),
      fetchUsgs(),
      fetchLiveJson().catch(() => null),
    ]);

    renderGdacsOnMap(gdacs);
    renderUsgsOnMap(usgs);
    if (live) {
      lastFeedPayload = live;
      renderAlerts(live);
    } else {
      renderAlerts(lastFeedPayload || { alerts: [], fetchedAt: null });
    }

    if (status) {
      status.textContent = t(lang, "liveUpdating");
      status.classList.remove("error");
    }
  } catch {
    if (status) {
      status.textContent = t(lang, "liveError");
      status.classList.add("error");
    }
  }
}

function wireUi() {
  document.querySelectorAll(".country-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.getAttribute("data-country");
      if (c === "israel" || c === "lebanon" || c === "iran") setCountry(c);
      refreshRemoteLayers();
    });
  });

  document.querySelectorAll(".btn-lang").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = btn.getAttribute("data-lang");
      if (l === "en" || l === "ar") setLang(l);
    });
  });

  ["layer-gdacs", "layer-usgs", "layer-feed"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      refreshRemoteLayers();
    });
  });

  const btnNotify = document.getElementById("btn-notify");
  btnNotify?.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("Notifications not supported");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      notifyEnabled = true;
      const baseline = filterAlertsForCountry(lastFeedPayload || { alerts: [] }, country);
      previousAlertIds = new Set(
        baseline.map((a) => String(a.id || `${a.source}|${a.title}|${a.published}`))
      );
      btnNotify.classList.add("active");
      btnNotify.setAttribute("aria-pressed", "true");
      btnNotify.textContent = t(lang, "notifyGranted");
    } else {
      btnNotify.textContent = t(lang, "notifyDenied");
    }
  });

  document.getElementById("copy-wise")?.addEventListener("click", async () => {
    const ref = document.getElementById("wise-ref")?.textContent || "78935292";
    try {
      await navigator.clipboard.writeText(ref);
      const b = document.getElementById("copy-wise");
      if (b) b.textContent = t(lang, "copied");
      setTimeout(() => {
        if (b) b.textContent = t(lang, "copyRef");
      }, 2000);
    } catch {
      /* ignore */
    }
  });

  const sources = document.getElementById("source-list");
  if (sources) {
    sources.innerHTML = `
      <li><a href="https://www.gdacs.org/" target="_blank" rel="noopener">GDACS</a> (UN / EU JRC framework)</li>
      <li><a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener">USGS Earthquake Hazards</a></li>
      <li><a href="https://news.un.org/en/rss-feeds" target="_blank" rel="noopener">UN News RSS</a> (merged by optional updater)</li>
      <li><a href="https://www.oref.org.il/" target="_blank" rel="noopener">Israel Home Front Command</a> (official; JSON often geo-restricted — use proxy in workflow)</li>
      <li><a href="https://acleddata.com/" target="_blank" rel="noopener">ACLED</a> (weekly API — add credentials if you extend the fetch script)</li>
    `;
  }
}

applyI18n(lang);
document.querySelectorAll(".btn-lang").forEach((btn) => {
  btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
});
document.querySelectorAll(".country-tabs .tab").forEach((btn) => {
  btn.classList.toggle("active", btn.getAttribute("data-country") === country);
});

wireUi();
initMap();
updateLegend();
refreshRemoteLayers();
setInterval(refreshRemoteLayers, POLL_MS);
