(function () {
"use strict";

const MEDIA_PATH = "media";

const CATEGORY_BY_EXT = {
  image: ["jpg", "jpeg", "png", "webp", "avif", "bmp", "svg"],
  gif: ["gif"],
  video: ["mp4", "webm", "mov", "ogv", "m4v"],
  audio: ["mp3", "wav", "m4a", "flac", "ogg"]
};
function categoryFor(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  for (const [category, list] of Object.entries(CATEGORY_BY_EXT)) {
    if (list.includes(ext)) return category;
  }
  return null;
}

function detectRepo() {
  const host = location.hostname;
  if (!host.endsWith(".github.io")) return null;
  const owner = host.split(".")[0];
  const firstSegment = location.pathname.split("/").filter(Boolean)[0];
  const repo = firstSegment || `${owner}.github.io`;
  return { owner, repo };
}
const REPO = detectRepo();

const ICONS = {
  starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.16 3.6 1.64-6.99-5.36-4.64 7.06-.6L12 2l2.82 6.67 7.06.6-5.36 4.64 1.64 6.99z"/></svg>',
  starFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.16 3.6 1.64-6.99-5.36-4.64 7.06-.6L12 2l2.82 6.67 7.06.6-5.36 4.64 1.64 6.99z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.6 21.6 0 015.06-6.06M9.9 4.24A10.4 10.4 0 0112 4c7 0 11 8 11 8a21.6 21.6 0 01-2.6 3.79M14.12 14.12a3 3 0 11-4.24-4.24"/><path d="M1 1l22 22"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M22 8l-5 4 5 4V8z"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>'
};

/* ---------- local IndexedDB (drag & drop / Add files) ---------- */
const DB_NAME = "galleryLocalDB";
const STORE = "files";
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}
async function dbAdd(record) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(record);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function dbGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/* ---------- client-only preferences ---------- */
function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

const DEFAULT_SETTINGS = { thumbSize: 190, autoplay: true, reduceMotion: false, confirmRemove: true };
let settings = Object.assign({}, DEFAULT_SETTINGS, loadJSON("gallery_settings", {}));
let favorites = new Set(loadJSON("gallery_favorites", []));
let hidden = new Set(loadJSON("gallery_hidden", []));

function saveSettings() { saveJSON("gallery_settings", settings); }
function saveFavorites() { saveJSON("gallery_favorites", Array.from(favorites)); }
function saveHidden() { saveJSON("gallery_hidden", Array.from(hidden)); }

/* ---------- state ---------- */
let repoItems = [];
let localItems = [];
let items = [];
let filterType = "all";
let searchQuery = "";
let sortMode = "name-asc";
let currentLightboxList = [];
let currentLightboxIndex = -1;
let confirmResolver = null;

/* ---------- dom refs ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const galleryGrid = $("#galleryGrid");
const emptyLibrary = $("#emptyLibrary");
const emptyLibraryText = $("#emptyLibraryText");
const emptyResults = $("#emptyResults");
const searchInput = $("#searchInput");
const searchClearBtn = $("#searchClearBtn");
const sortSelect = $("#sortSelect");
const filterNav = $("#filterNav");
const meterText = $("#meterText");
const fileInput = $("#fileInput");
const dragOverlay = $("#dragOverlay");

const lightbox = $("#lightbox");
const lbFilename = $("#lbFilename");
const lbStage = $("#lbStage");
const lbFilmstrip = $("#lbFilmstrip");
const lbFavBtn = $("#lbFavBtn");
const lbRemoveBtn = $("#lbRemoveBtn");

const infoPanel = $("#infoPanel");
const infoBody = $("#infoBody");
const settingsPanel = $("#settingsPanel");
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
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 250); }, 2200);
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
   REPO MEDIA — fetched live from GitHub, no build step involved
============================================================ */
async function fetchRepoItems() {
  if (!REPO) return [];
  const url = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/${MEDIA_PATH}`;
  let res;
  try { res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } }); }
  catch (e) { showToast("Couldn't reach GitHub to load repository media"); return []; }

  if (res.status === 404) return [];
  if (res.status === 403) { showToast("GitHub API rate limit reached — repository media will reappear shortly"); return []; }
  if (!res.ok) { showToast("Couldn't load repository media"); return []; }

  const entries = await res.json();
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((e) => e.type === "file" && categoryFor(e.name))
    .map((e) => ({
      id: "repo:" + e.path,
      name: e.name,
      url: e.download_url,
      category: categoryFor(e.name),
      size: e.size || 0,
      source: "repo"
    }));
}

async function loadLocalItems() {
  try {
    const records = await dbGetAll();
    return records.map((r) => ({
      id: r.id, name: r.name, url: URL.createObjectURL(r.blob),
      category: r.category, size: r.size, source: "local"
    }));
  } catch (e) { return []; }
}

function mergeItems() {
  items = repoItems.concat(localItems);
  items.forEach((i) => { i.width = i.width || 0; i.height = i.height || 0; i.duration = i.duration || 0; i.thumb = i.thumb || null; i.favorite = favorites.has(i.id); });
}

/* ============================================================
   IMPORT (drag & drop / Add files) — stored locally in this browser
============================================================ */
async function importFiles(fileList) {
  const files = Array.from(fileList).filter((f) => categoryFor(f.name));
  if (files.length === 0) { showToast("No supported media files found"); return; }
  for (const file of files) {
    const id = "local:" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random());
    await dbAdd({ id, name: file.name, category: categoryFor(file.name), size: file.size, blob: file });
  }
  localItems = await loadLocalItems();
  mergeItems();
  render();
  showToast(`Added ${files.length} file${files.length > 1 ? "s" : ""} — visible only in this browser`);
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
    case "name-desc": list.sort((a, b) => b.name.localeCompare(a.name)); break;
    case "size-desc": list.sort((a, b) => b.size - a.size); break;
    case "size-asc": list.sort((a, b) => a.size - b.size); break;
    default: list.sort((a, b) => a.name.localeCompare(b.name));
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
      <button data-action="remove" aria-label="${item.source === "local" ? "Delete" : "Hide"}">${item.source === "local" ? ICONS.trash : ICONS.hide}</button>
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

  emptyLibrary.classList.toggle("hidden", items.length !== 0);
  emptyResults.classList.toggle("hidden", !(items.length !== 0 && filtered.length === 0));
  galleryGrid.style.display = filtered.length ? "grid" : "none";

  if (!REPO) {
    emptyLibraryText.textContent = "Drag and drop files here, or use Add files.";
  }

  galleryGrid.innerHTML = filtered.map(cardTemplate).join("");

  const totalSize = filtered.reduce((s, i) => s + i.size, 0);
  meterText.textContent = `${filtered.length} file${filtered.length === 1 ? "" : "s"} · ${bytesToSize(totalSize)}`;

  wireLazyMedia();
  updateSettingsStats();
}

const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    lazyObserver.unobserve(entry.target);
    resolveCardMeta(entry.target);
  });
}, { rootMargin: "200px" });

function wireLazyMedia() {
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
    img.onload = () => { item.width = img.naturalWidth; item.height = img.naturalHeight; updateCardSub(item); };
    img.src = item.url;
  } else if (item.category === "video") {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
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
  } catch (e) { /* cross-origin or decode failure — fallback icon stays */ }
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
    else if (action === "remove") removeItem(id);
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
   FAVORITE / DOWNLOAD / REMOVE
============================================================ */
function toggleFavorite(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  item.favorite ? favorites.add(id) : favorites.delete(id);
  saveFavorites();
  render();
  if (lightbox.classList.contains("open")) syncLightboxState();
  if (infoPanel.classList.contains("open") && infoPanel.dataset.itemId === id) openInfoPanel(id);
}

async function downloadItem(item) {
  if (!item) return;
  try {
    const res = await fetch(item.url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = item.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) { showToast("Download failed"); }
}

async function removeItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  const isLocal = item.source === "local";

  if (settings.confirmRemove) {
    const ok = await confirmDialog(
      isLocal ? "Delete this file?" : "Hide this file?",
      isLocal
        ? `"${item.name}" will be permanently removed from this browser's local library.`
        : `"${item.name}" will be hidden from your gallery on this device. It stays in the repository — use Settings → Restore all to bring it back.`,
      isLocal ? "Delete" : "Hide"
    );
    if (!ok) return;
  }

  if (isLocal) {
    await dbDelete(id);
    URL.revokeObjectURL(item.url);
    localItems = localItems.filter((i) => i.id !== id);
  } else {
    hidden.add(id);
    saveHidden();
  }
  mergeItems();

  if (lightbox.classList.contains("open")) {
    const current = currentLightboxList[currentLightboxIndex];
    if (current && current.id === id) closeLightbox();
  }
  if (infoPanel.classList.contains("open") && infoPanel.dataset.itemId === id) closePanel(infoPanel);

  render();
  showToast(isLocal ? "File deleted" : "File hidden");
}

function restoreHidden() {
  hidden.clear();
  saveHidden();
  render();
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
      <div><dt>Source</dt><dd>${item.source === "local" ? "Local (this browser)" : "Repository"}</dd></div>
      <div><dt>Favorite</dt><dd>${item.favorite ? "Yes" : "No"}</dd></div>
    </dl>
    <div class="info-actions">
      <button class="btn" data-action="download">${ICONS.download} Download</button>
      <button class="btn danger" data-action="remove">${item.source === "local" ? ICONS.trash : ICONS.hide} ${item.source === "local" ? "Delete" : "Hide"}</button>
    </div>`;
  infoBody.querySelector('[data-action="download"]').addEventListener("click", () => downloadItem(item));
  infoBody.querySelector('[data-action="remove"]').addEventListener("click", () => removeItem(item.id));
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
  syncLightboxState();
  renderFilmstrip();
}
function syncLightboxState() {
  const item = currentLightboxList[currentLightboxIndex];
  if (!item) return;
  lbFavBtn.classList.toggle("active", item.favorite);
  lbFavBtn.innerHTML = item.favorite ? ICONS.starFilled : ICONS.starOutline;
  lbRemoveBtn.innerHTML = item.source === "local" ? ICONS.trash : ICONS.hide;
  lbRemoveBtn.setAttribute("aria-label", item.source === "local" ? "Delete" : "Hide");
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
lightbox.querySelector('[data-action="remove"]').addEventListener("click", () => {
  const item = currentLightboxList[currentLightboxIndex];
  if (item) removeItem(item.id);
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
  if (![infoPanel, settingsPanel].some((p) => p.classList.contains("open"))) scrim.classList.remove("show");
}
function closeAllPanels() { [infoPanel, settingsPanel].forEach(closePanel); }

$("#settingsBtn").addEventListener("click", () => openPanel(settingsPanel));
$$(".panel-close").forEach((btn) => {
  btn.addEventListener("click", () => closePanel(btn.dataset.panel === "info" ? infoPanel : settingsPanel));
});
scrim.addEventListener("click", closeAllPanels);

/* ============================================================
   SEARCH / SORT / FILTER
============================================================ */
let searchDebounce;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchClearBtn.classList.toggle("show", !!searchInput.value);
  searchDebounce = setTimeout(() => { searchQuery = searchInput.value.trim(); render(); }, 150);
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
   ADD FILES — button + drag & drop
============================================================ */
$("#addFilesBtn").addEventListener("click", () => fileInput.click());
$("#emptyAddFilesBtn").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) importFiles(fileInput.files);
  fileInput.value = "";
});

let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes("Files")) return;
  dragCounter++;
  dragOverlay.classList.add("show");
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) dragOverlay.classList.remove("show");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dragOverlay.classList.remove("show");
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
});

/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */
document.addEventListener("keydown", (e) => {
  if (e.target === searchInput) return;
  if (e.key === "Escape") {
    if (lightbox.classList.contains("open")) closeLightbox();
    else if ([infoPanel, settingsPanel].some((p) => p.classList.contains("open"))) closeAllPanels();
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
function updateSettingsStats() {
  $("#hiddenCountText").textContent = `${hidden.size} hidden on this device`;
  $("#statRepoCount").textContent = `${repoItems.length} file${repoItems.length === 1 ? "" : "s"}`;
  $("#statLocalCount").textContent = `${localItems.length} file${localItems.length === 1 ? "" : "s"}`;
}
function applySettings() {
  document.documentElement.style.setProperty("--thumb-size", settings.thumbSize + "px");
  document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  $$("#thumbSizeGroup .pill").forEach((p) => p.classList.toggle("active", parseInt(p.dataset.size, 10) === settings.thumbSize));
  $("#toggleAutoplay").classList.toggle("on", settings.autoplay);
  $("#toggleMotion").classList.toggle("on", settings.reduceMotion);
  $("#toggleConfirmRemove").classList.toggle("on", settings.confirmRemove);
}
$("#thumbSizeGroup").addEventListener("click", (e) => {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  settings.thumbSize = parseInt(pill.dataset.size, 10);
  saveSettings(); applySettings();
});
$("#toggleAutoplay").addEventListener("click", () => { settings.autoplay = !settings.autoplay; saveSettings(); applySettings(); render(); });
$("#toggleMotion").addEventListener("click", () => { settings.reduceMotion = !settings.reduceMotion; saveSettings(); applySettings(); });
$("#toggleConfirmRemove").addEventListener("click", () => { settings.confirmRemove = !settings.confirmRemove; saveSettings(); applySettings(); });
$("#restoreHiddenBtn").addEventListener("click", restoreHidden);

/* ============================================================
   INIT
============================================================ */
async function init() {
  applySettings();
  sortSelect.value = sortMode;
  const [repo, local] = await Promise.all([fetchRepoItems(), loadLocalItems()]);
  repoItems = repo;
  localItems = local;
  mergeItems();
  render();
}
init();

})();
