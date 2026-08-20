(function () {
"use strict";

const MEDIA_DIR = "media/";
const MANIFEST_URL = MEDIA_DIR + "manifest.json";

const ICONS = {
  starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.16 3.6 1.64-6.99-5.36-4.64 7.06-.6L12 2l2.82 6.67 7.06.6-5.36 4.64 1.64 6.99z"/></svg>',
  starFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.16 3.6 1.64-6.99-5.36-4.64 7.06-.6L12 2l2.82 6.67 7.06.6-5.36 4.64 1.64 6.99z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.6 21.6 0 015.06-6.06M9.9 4.24A10.4 10.4 0 0112 4c7 0 11 8 11 8a21.6 21.6 0 01-2.6 3.79M14.12 14.12a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M22 8l-5 4 5 4V8z"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>'
};

/* ---------- local (client-only) preferences ---------- */
const DEFAULT_SETTINGS = { thumbSize: 190, autoplay: true, reduceMotion: false, confirmHide: true };

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

let settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON("gallery_settings", {}));
let favorites = new Set(loadJSON("gallery_favorites", []));
let hidden = new Set(loadJSON("gallery_hidden", []));

function saveSettings() { saveJSON("gallery_settings", settings); }
function saveFavorites() { saveJSON("gallery_favorites", Array.from(favorites)); }
function saveHidden() { saveJSON("gallery_hidden", Array.from(hidden)); }

/* ---------- state ---------- */
let items = [];
let filterType = "all";
let searchQuery = "";
let sortMode = "date-desc";
let currentLightboxList = [];
let currentLightboxIndex = -1;
let confirmResolver = null;

/* ---------- dom refs ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const galleryGrid = $("#galleryGrid");
const emptyLibrary = $("#emptyLibrary");
const emptyResults = $("#emptyResults");
const loadError = $("#loadError");
const searchInput = $("#searchInput");
const searchClearBtn = $("#searchClearBtn");
const sortSelect = $("#sortSelect");
const filterNav = $("#filterNav");
const meterText = $("#meterText");

const lightbox = $("#lightbox");
const lbFilename = $("#lbFilename");
const lbStage = $("#lbStage");
const lbFilmstrip = $("#lbFilmstrip");
const lbFavBtn = $("#lbFavBtn");

const infoPanel = $("#infoPanel");
const infoBody = $("#infoBody");
const settingsPanel = $("#settingsPanel");
const addMediaPanel = $("#addMediaPanel");
const scrim = $("#scrim");

const confirmModal = $("#confirmModal");
const confirmTitle = $("#confirmTitle");
const confirmMessage = $("#confirmMessage");
const confirmCancelBtn = $("#confirmCancelBtn");
const confirmOkBtn = $("#confirmOkBtn");

const toastContainer = $("#toastContainer");

/* ---------- utils ---------- */
function bytesToSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
function formatDuration(sec) {
  if (!sec || !isFinite(sec)) return "";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 250);
  }, 2200);
}

function confirmDialog(title, message, okLabel = "Confirm") {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOkBtn.textContent = okLabel;
  confirmModal.classList.add("show");
  return new Promise((resolve) => { confirmResolver = resolve; });
}
function closeConfirm(result) {
  confirmModal.classList.remove("show");
  if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
}
confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
confirmOkBtn.addEventListener("click", () => closeConfirm(true));
confirmModal.addEventListener("click", (e) => { if (e.target === confirmModal) closeConfirm(false); });

/* ============================================================
   LOAD MANIFEST
   Each entry: { file, category, size, dateAdded }
   Width/height/duration are resolved lazily in the browser.
============================================================ */
async function loadManifest() {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("manifest not found");
  const manifest = await res.json();
  items = manifest.map((entry) => ({
    id: entry.file,
    name: entry.file,
    url: MEDIA_DIR + encodeURIComponent(entry.file),
    category: entry.category,
    size: entry.size || 0,
    dateAdded: entry.dateAdded || 0,
    width: 0,
    height: 0,
    duration: 0,
    thumb: null,
    favorite: favorites.has(entry.file)
  }));
}

/* ============================================================
   FILTER / SORT
============================================================ */
function getFilteredItems() {
  let list = items.filter((i) => !hidden.has(i.id));
  if (filterType === "favorites") list = list.filter((i) => i.favorite);
  else if (filterType !== "all") list = list.filter((i) => i.category === filterType);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((i) => i.name.toLowerCase().includes(q));
  }
  switch (sortMode) {
    case "date-asc": list.sort((a, b) => a.dateAdded - b.dateAdded); break;
    case "name-asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "name-desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
    case "size-desc": list.sort((a, b) => b.size - a.size); break;
    case "size-asc": list.sort((a, b) => a.size - b.size); break;
    default: list.sort((a, b) => b.dateAdded - a.dateAdded);
  }
  return list;
}

function updateCounts() {
  const visible = items.filter((i) => !hidden.has(i.id));
  const counts = { all: visible.length, image: 0, video: 0, gif: 0, audio: 0, favorites: 0 };
  visible.forEach((i) => {
    if (counts[i.category] !== undefined) counts[i.category]++;
    if (i.favorite) counts.favorites++;
  });
  $$(".count").forEach((el) => { el.textContent = counts[el.dataset.count] ?? 0; });
}

/* ============================================================
   RENDER — GALLERY
============================================================ */
function cardTemplate(item) {
  let thumbHtml;
  if (item.category === "image" || item.category === "gif") {
    thumbHtml = `<img src="${item.url}" alt="${escapeHtml(item.name)}" loading="lazy">`;
  } else if (item.category === "video") {
    thumbHtml = `<div class="thumb-video-wrap">
        <div class="poster-fallback">${ICONS.video}</div>
        <video muted loop playsinline preload="none" data-src="${item.url}"></video>
        <span class="play-badge">${ICONS.play}</span>
        ${item.duration ? `<span class="duration-badge">${formatDuration(item.duration)}</span>` : ""}
      </div>`;
  } else if (item.category === "audio") {
    thumbHtml = `<div class="thumb-generic">${ICONS.music}</div>`;
  } else {
    thumbHtml = `<div class="thumb-generic">${ICONS.file}</div>`;
  }
  return `
  <article class="card" data-id="${escapeHtml(item.id)}" tabindex="0">
    <div class="thumb">
      ${thumbHtml}
      ${item.category === "gif" ? '<span class="tag-badge">GIF</span>' : ""}
    </div>
    <button class="fav-btn ${item.favorite ? "active" : ""}" data-action="favorite" aria-label="Toggle favorite">${item.favorite ? ICONS.starFilled : ICONS.starOutline}</button>
    <div class="card-actions">
      <button data-action="info" aria-label="Details">${ICONS.info}</button>
      <button data-action="download" aria-label="Download">${ICONS.download}</button>
      <button data-action="hide" aria-label="Hide">${ICONS.hide}</button>
    </div>
    <div class="card-meta">
      <span class="card-name">${escapeHtml(item.name)}</span>
      <span class="card-sub" data-sub="${escapeHtml(item.id)}">${bytesToSize(item.size)}</span>
    </div>
  </article>`;
}

function render() {
  const filtered = getFilteredItems();
  updateCounts();

  loadError.classList.add("hidden");
  emptyLibrary.classList.toggle("hidden", items.length !== 0);
  emptyResults.classList.toggle("hidden", !(items.length !== 0 && filtered.length === 0));
  galleryGrid.style.display = filtered.length ? "grid" : "none";

  galleryGrid.innerHTML = filtered.map(cardTemplate).join("");

  const totalSize = filtered.reduce((s, i) => s + i.size, 0);
  meterText.textContent = `${filtered.length} file${filtered.length === 1 ? "" : "s"} · ${bytesToSize(totalSize)}`;

  wireLazyMedia(filtered);
}

/* Resolve dimensions/poster lazily, only for cards that scroll into view. */
const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    lazyObserver.unobserve(entry.target);
    resolveCardMeta(entry.target);
  });
}, { rootMargin: "200px" });

function wireLazyMedia(filtered) {
  galleryGrid.querySelectorAll(".card").forEach((card) => lazyObserver.observe(card));

  if (settings.autoplay) {
    galleryGrid.querySelectorAll(".thumb-video-wrap").forEach((wrap) => {
      const video = wrap.querySelector("video");
      wrap.addEventListener("mouseenter", () => {
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
        wrap.classList.add("playing");
      });
      wrap.addEventListener("mouseleave", () => {
        video.pause();
        wrap.classList.remove("playing");
      });
    });
  }
}

function resolveCardMeta(cardEl) {
  const id = cardEl.dataset.id;
  const item = items.find((i) => i.id === id);
  if (!item || item.width) return;

  if (item.category === "image" || item.category === "gif") {
    const img = new Image();
    img.onload = () => {
      item.width = img.naturalWidth; item.height = img.naturalHeight;
      updateCardSub(item);
    };
    img.src = item.url;
  } else if (item.category === "video") {
    const video = document.createElement("video");
    video.src = item.url; video.muted = true; video.playsInline = true; video.preload = "metadata";
    video.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px;";
    document.body.appendChild(video);
    video.addEventListener("loadeddata", () => {
      try { video.currentTime = Math.min(0.6, (video.duration || 1) / 3); }
      catch (e) { finishVideoMeta(item, video, cardEl); }
    });
    video.addEventListener("seeked", () => finishVideoMeta(item, video, cardEl));
    video.addEventListener("error", () => video.remove());
  }
}

function finishVideoMeta(item, video, cardEl) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    item.thumb = canvas.toDataURL("image/jpeg", 0.72);
  } catch (e) { /* cross-origin or decode failure — keep fallback icon */ }
  item.width = video.videoWidth; item.height = video.videoHeight; item.duration = video.duration || 0;
  video.remove();
  updateCardSub(item);
  if (item.thumb && cardEl) {
    const poster = cardEl.querySelector(".poster-fallback");
    if (poster) poster.outerHTML = `<img class="poster" src="${item.thumb}" alt="">`;
  }
  if (item.duration && cardEl && !cardEl.querySelector(".duration-badge")) {
    const wrap = cardEl.querySelector(".thumb-video-wrap");
    if (wrap) wrap.insertAdjacentHTML("beforeend", `<span class="duration-badge">${formatDuration(item.duration)}</span>`);
  }
}

function updateCardSub(item) {
  const sub = galleryGrid.querySelector(`.card-sub[data-sub="${CSS.escape(item.id)}"]`);
  if (sub) sub.textContent = `${bytesToSize(item.size)} · ${item.width}×${item.height}`;
  if (infoPanel.classList.contains("open") && infoPanel.dataset.itemId === item.id) openInfoPanel(item.id);
}

/* ============================================================
   GALLERY EVENT DELEGATION
============================================================ */
galleryGrid.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("button[data-action]");
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id;
  if (actionBtn) {
    e.stopPropagation();
    const action = actionBtn.dataset.action;
    if (action === "favorite") toggleFavorite(id);
    else if (action === "info") openInfoPanel(id);
    else if (action === "download") downloadItem(items.find((i) => i.id === id));
    else if (action === "hide") hideItem(id);
    return;
  }
  openLightbox(id);
});
galleryGrid.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".card");
    if (card) { e.preventDefault(); openLightbox(card.dataset.id); }
  }
});

/* ============================================================
   FAVORITE / DOWNLOAD / HIDE
============================================================ */
function toggleFavorite(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  item.favorite ? favorites.add(id) : favorites.delete(id);
  saveFavorites();
  render();
  if (lightbox.classList.contains("open")) syncLightboxFav();
  if (infoPanel.classList.contains("open") && infoPanel.dataset.itemId === id) openInfoPanel(id);
}

function downloadItem(item) {
  if (!item) return;
  const a = document.createElement("a");
  a.href = item.url; a.download = item.name;
  document.body.appendChild(a); a.click(); a.remove();
}

async function hideItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  if (settings.confirmHide) {
    const ok = await confirmDialog("Hide this file?", `"${item.name}" will be hidden from your gallery on this device. The file itself stays in the media folder — use Settings → Restore all to bring it back.`, "Hide");
    if (!ok) return;
  }
  hidden.add(id);
  saveHidden();
  if (lightbox.classList.contains("open")) {
    const current = currentLightboxList[currentLightboxIndex];
    if (current && current.id === id) closeLightbox();
  }
  if (infoPanel.classList.contains("open") && infoPanel.dataset.itemId === id) closePanel(infoPanel);
  render();
  updateHiddenCount();
  showToast("File hidden");
}

function restoreHidden() {
  hidden.clear();
  saveHidden();
  render();
  updateHiddenCount();
  showToast("Hidden files restored");
}

/* ============================================================
   INFO PANEL
============================================================ */
function infoPreviewHtml(item) {
  if (item.category === "image" || item.category === "gif") return `<img src="${item.url}" alt="">`;
  if (item.category === "video") return item.thumb ? `<img src="${item.thumb}" alt="">` : ICONS.video;
  if (item.category === "audio") return ICONS.music;
  return ICONS.file;
}
function openInfoPanel(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  infoPanel.dataset.itemId = id;
  infoBody.innerHTML = `
    <div class="info-preview">${infoPreviewHtml(item)}</div>
    <dl class="detail-list">
      <div><dt>Filename</dt><dd>${escapeHtml(item.name)}</dd></div>
      <div><dt>Category</dt><dd>${capitalize(item.category)}</dd></div>
      <div><dt>Size</dt><dd>${bytesToSize(item.size)}</dd></div>
      ${item.width ? `<div><dt>Dimensions</dt><dd>${item.width} × ${item.height}px</dd></div>` : ""}
      ${item.duration ? `<div><dt>Duration</dt><dd>${formatDuration(item.duration)}</dd></div>` : ""}
      ${item.dateAdded ? `<div><dt>Modified</dt><dd>${formatDate(item.dateAdded)}</dd></div>` : ""}
      <div><dt>Favorite</dt><dd>${item.favorite ? "Yes" : "No"}</dd></div>
    </dl>
    <div class="info-actions">
      <button class="btn" data-action="download">${ICONS.download} Download</button>
      <button class="btn danger" data-action="hide">${ICONS.hide} Hide</button>
    </div>`;
  infoBody.querySelector('[data-action="download"]').addEventListener("click", () => downloadItem(item));
  infoBody.querySelector('[data-action="hide"]').addEventListener("click", () => hideItem(item.id));
  openPanel(infoPanel);
}

/* ============================================================
   LIGHTBOX
============================================================ */
function openLightbox(id) {
  currentLightboxList = getFilteredItems();
  currentLightboxIndex = currentLightboxList.findIndex((i) => i.id === id);
  if (currentLightboxIndex === -1) return;
  renderLightbox();
  lightbox.classList.add("open");
  document.body.classList.add("no-scroll");
}
function closeLightbox() {
  lightbox.classList.remove("open");
  document.body.classList.remove("no-scroll");
  lbStage.innerHTML = "";
}
function lbStageHtml(item) {
  if (item.category === "image" || item.category === "gif") return `<img src="${item.url}" alt="${escapeHtml(item.name)}">`;
  if (item.category === "video") return `<video src="${item.url}" controls autoplay playsinline></video>`;
  if (item.category === "audio") return `<div class="audio-stage">${ICONS.music}<audio src="${item.url}" controls autoplay></audio></div>`;
  return `<div class="generic-stage">${ICONS.file}<p>Preview not available for this file type</p></div>`;
}
function renderLightbox() {
  const item = currentLightboxList[currentLightboxIndex];
  if (!item) return;
  lbFilename.textContent = item.name;
  lbStage.innerHTML = lbStageHtml(item);
  syncLightboxFav();
  renderFilmstrip();
}
function syncLightboxFav() {
  const item = currentLightboxList[currentLightboxIndex];
  if (!item) return;
  lbFavBtn.classList.toggle("active", item.favorite);
  lbFavBtn.innerHTML = item.favorite ? ICONS.starFilled : ICONS.starOutline;
}
function renderFilmstrip() {
  lbFilmstrip.innerHTML = currentLightboxList.map((it, idx) => {
    let inner;
    if (it.category === "image" || it.category === "gif") inner = `<img src="${it.url}" alt="">`;
    else if (it.category === "video") inner = it.thumb ? `<img src="${it.thumb}" alt="">` : ICONS.video;
    else if (it.category === "audio") inner = ICONS.music;
    else inner = ICONS.file;
    return `<div class="lb-thumb ${idx === currentLightboxIndex ? "active" : ""}" data-idx="${idx}">${inner}</div>`;
  }).join("");
  const activeThumb = lbFilmstrip.querySelector(".lb-thumb.active");
  if (activeThumb) activeThumb.scrollIntoView({ block: "nearest", inline: "center" });
}
function lbNav(delta) {
  if (currentLightboxList.length === 0) return;
  currentLightboxIndex = (currentLightboxIndex + delta + currentLightboxList.length) % currentLightboxList.length;
  renderLightbox();
}

lightbox.querySelector(".lb-prev").addEventListener("click", () => lbNav(-1));
lightbox.querySelector(".lb-next").addEventListener("click", () => lbNav(1));
lightbox.querySelector('[data-action="close"]').addEventListener("click", closeLightbox);
lightbox.querySelector('[data-action="favorite"]').addEventListener("click", () => {
  const item = currentLightboxList[currentLightboxIndex];
  if (item) toggleFavorite(item.id);
});
lightbox.querySelector('[data-action="download"]').addEventListener("click", () => {
  downloadItem(currentLightboxList[currentLightboxIndex]);
});
lightbox.querySelector('[data-action="hide"]').addEventListener("click", () => {
  const item = currentLightboxList[currentLightboxIndex];
  if (item) hideItem(item.id);
});
lightbox.querySelector('[data-action="info"]').addEventListener("click", () => {
  const item = currentLightboxList[currentLightboxIndex];
  if (item) openInfoPanel(item.id);
});
lbFilmstrip.addEventListener("click", (e) => {
  const thumb = e.target.closest(".lb-thumb");
  if (!thumb) return;
  currentLightboxIndex = parseInt(thumb.dataset.idx, 10);
  renderLightbox();
});

let touchStartX = null;
lightbox.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
lightbox.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) lbNav(dx > 0 ? -1 : 1);
  touchStartX = null;
}, { passive: true });

/* ============================================================
   PANELS
============================================================ */
function openPanel(panel) { panel.classList.add("open"); scrim.classList.add("show"); }
function closePanel(panel) {
  panel.classList.remove("open");
  if (![infoPanel, settingsPanel, addMediaPanel].some((p) => p.classList.contains("open"))) {
    scrim.classList.remove("show");
  }
}
function closeAllPanels() { [infoPanel, settingsPanel, addMediaPanel].forEach(closePanel); }

$("#settingsBtn").addEventListener("click", () => openPanel(settingsPanel));
$("#addMediaBtn").addEventListener("click", () => openPanel(addMediaPanel));
$("#emptyAddMediaBtn").addEventListener("click", () => openPanel(addMediaPanel));
$$(".panel-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const map = { info: infoPanel, settings: settingsPanel, addMedia: addMediaPanel };
    closePanel(map[btn.dataset.panel]);
  });
});
scrim.addEventListener("click", closeAllPanels);

/* ============================================================
   SEARCH / SORT / FILTER
============================================================ */
let searchDebounce;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchClearBtn.classList.toggle("show", !!searchInput.value);
  searchDebounce = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    render();
  }, 150);
});
searchClearBtn.addEventListener("click", () => {
  searchInput.value = ""; searchQuery = "";
  searchClearBtn.classList.remove("show");
  render();
  searchInput.focus();
});
sortSelect.addEventListener("change", () => { sortMode = sortSelect.value; render(); });
filterNav.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  filterNav.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  filterType = chip.dataset.filter;
  render();
});

/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */
document.addEventListener("keydown", (e) => {
  if (e.target === searchInput) return;
  if (e.key === "Escape") {
    if (lightbox.classList.contains("open")) closeLightbox();
    else if ([infoPanel, settingsPanel, addMediaPanel].some((p) => p.classList.contains("open"))) closeAllPanels();
    else if (confirmModal.classList.contains("show")) closeConfirm(false);
    return;
  }
  if (!lightbox.classList.contains("open")) return;
  if (e.target.tagName === "VIDEO" || e.target.tagName === "AUDIO") return;
  if (e.key === "ArrowLeft") lbNav(-1);
  else if (e.key === "ArrowRight") lbNav(1);
});

/* ============================================================
   SETTINGS WIRING
============================================================ */
function updateHiddenCount() {
  $("#hiddenCountText").textContent = `${hidden.size} hidden on this device`;
}
function applySettings() {
  document.documentElement.style.setProperty("--thumb-size", settings.thumbSize + "px");
  document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  $$("#thumbSizeGroup .pill").forEach((p) => p.classList.toggle("active", parseInt(p.dataset.size, 10) === settings.thumbSize));
  $("#toggleAutoplay").classList.toggle("on", settings.autoplay);
  $("#toggleMotion").classList.toggle("on", settings.reduceMotion);
  $("#toggleConfirmHide").classList.toggle("on", settings.confirmHide);
  updateHiddenCount();
}
$("#thumbSizeGroup").addEventListener("click", (e) => {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  settings.thumbSize = parseInt(pill.dataset.size, 10);
  saveSettings(); applySettings();
});
$("#toggleAutoplay").addEventListener("click", () => { settings.autoplay = !settings.autoplay; saveSettings(); applySettings(); render(); });
$("#toggleMotion").addEventListener("click", () => { settings.reduceMotion = !settings.reduceMotion; saveSettings(); applySettings(); });
$("#toggleConfirmHide").addEventListener("click", () => { settings.confirmHide = !settings.confirmHide; saveSettings(); applySettings(); });
$("#restoreHiddenBtn").addEventListener("click", restoreHidden);

/* ============================================================
   INIT
============================================================ */
async function init() {
  applySettings();
  sortSelect.value = sortMode;
  try {
    await loadManifest();
    render();
    $("#statItemCount").textContent = `${items.length} file${items.length === 1 ? "" : "s"}`;
    $("#statSpaceUsed").textContent = bytesToSize(items.reduce((s, i) => s + i.size, 0));
  } catch (err) {
    console.error(err);
    loadError.classList.remove("hidden");
    emptyLibrary.classList.add("hidden");
    galleryGrid.style.display = "none";
  }
}
init();

})();
