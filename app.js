import { partnerBranding } from "./partner-branding.js";
import { formatDate, formatNumber, normalizeLanguage, translateText } from "./i18n.js";

let portalBranding = { ...partnerBranding };

const state = {
  loading: true,
  error: null,
  session: null,
  tools: [],
  filters: [],
  issues: [],
  impact: {},
  meta: null
};

const app = document.querySelector("#app");
const scope = document.querySelector("#scope");
const themeToggle = document.querySelector("#themeToggle");
const profileButton = document.querySelector("#profileButton");
const menuButton = document.querySelector("#menuButton");
const menuPanel = document.querySelector("#menuPanel");
const drawerScrim = document.querySelector("#drawerScrim");
const closeMenuButton = document.querySelector("#closeMenu");
const languageMenuButton = document.querySelector("#languageMenuButton");
const languageMenu = document.querySelector("#languageMenu");
const isPortalHost = document.documentElement.dataset.product === "portal";
const HUB_SNAPSHOT_KEY = "wata-tech-hub-snapshot-v1";
const HUB_SNAPSHOT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let currentLanguage = normalizeLanguage(localStorage.getItem("wata-language") || navigator.language);
document.documentElement.lang = currentLanguage;
document.title = isPortalHost ? "W.A.T.A. Filter Registry" : "W.A.T.A. Tech Hub";
const initialRoute = isPortalHost ? location.hash.slice(1) : "";
let selectedFilterId = initialRoute.startsWith("filter/") ? decodeURIComponent(initialRoute.slice(7)) : null;
let currentView = selectedFilterId ? "filter-detail" : initialRoute || "home";
let currentScope = "all";
let currentCountry = "all";
let registryMap = null;
let followupMode = "schedule";
let lifecycleSearch = "";
let lifecycleSort = "newest";

const countryProfiles = {
  CO: { name: "Colombia", flag: "🇨🇴", x: 29, y: 45, center: [4.5, -74], zoom: 5 },
  GT: { name: "Guatemala", flag: "🇬🇹", x: 22, y: 34, center: [15.5, -90.2], zoom: 7 },
  MM: { name: "Myanmar", flag: "🇲🇲", x: 76, y: 31, center: [21, 96], zoom: 5 }
};

const icons = {
  filter: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v3l2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-2V3Z"/><path d="M8 10h8M9.5 14h5M10 18h4"/></svg>`,
  impact: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C8.6 8 6 11.1 6 15a6 6 0 0 0 12 0c0-3.9-2.6-7-6-12Z"/><path d="M9.5 15.5c.4 1.4 1.3 2.2 2.7 2.5"/></svg>`,
  followup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/><path d="M19.5 11.5 17 9"/></svg>`,
  issue: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5v.1"/></svg>`,
  hub: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>`,
  book: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2V5Z"/><path d="M20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2V5Z"/></svg>`,
  people: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M16 4a3 3 0 0 1 0 6M15 14a5 5 0 0 1 6 4v2"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>`,
  map: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/><circle cx="15" cy="11" r="2"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>`
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function display(value, fallback = "—") {
  return value == null || value === "" ? translateText(fallback, currentLanguage) : escapeHtml(translateText(value, currentLanguage));
}

function date(value) {
  return value ? escapeHtml(formatDate(value, currentLanguage)) : "—";
}

function number(value) {
  return formatNumber(value, currentLanguage);
}

function dateKey(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/u);
  return match ? match[0] : "";
}

function dateValue(value) {
  const key = dateKey(value);
  return key ? Date.parse(`${key}T00:00:00Z`) : NaN;
}

function daysBetween(start, end) {
  const difference = dateValue(end) - dateValue(start);
  return Number.isFinite(difference) ? Math.round(difference / 86400000) : 0;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const textSources = new WeakMap();
const attributeSources = new WeakMap();
const translatableAttributes = ["aria-label", "title", "placeholder"];

function translateDom(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("script, style, [data-no-translate]")) continue;
    const source = textSources.get(node) ?? node.nodeValue;
    textSources.set(node, source);
    const match = source.match(/^(\s*)(.*?)(\s*)$/su);
    node.nodeValue = `${match[1]}${translateText(match[2], currentLanguage)}${match[3]}`;
  }
  const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
  for (const element of elements) {
    if (element.closest("[data-no-translate]")) continue;
    let sources = attributeSources.get(element);
    if (!sources) { sources = new Map(); attributeSources.set(element, sources); }
    for (const attribute of translatableAttributes) {
      if (!element.hasAttribute(attribute)) continue;
      if (!sources.has(attribute)) sources.set(attribute, element.getAttribute(attribute));
      element.setAttribute(attribute, translateText(sources.get(attribute), currentLanguage));
    }
  }
}

function syncLanguageControl() {
  if (!languageMenuButton) return;
  const label = translateText("Choose language", currentLanguage);
  languageMenuButton.setAttribute("aria-label", label);
  languageMenuButton.setAttribute("title", label);
  languageMenu?.querySelectorAll("[data-language]").forEach(option => {
    const active = option.dataset.language === currentLanguage;
    option.classList.toggle("active", active);
    option.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("#drawerLanguagePanel [data-language]").forEach(option => {
    const active = option.dataset.language === currentLanguage;
    option.classList.toggle("active", active);
    option.setAttribute("aria-pressed", String(active));
  });
  const drawerLanguageValue = document.querySelector("#drawerLanguageValue");
  if (drawerLanguageValue) drawerLanguageValue.textContent = currentLanguage === "es" ? "Español" : "English";
}

function setMenuOpen(open) {
  if (!menuPanel || !menuButton) return;
  menuPanel.hidden = !open;
  menuPanel.setAttribute("aria-hidden", String(!open));
  menuButton.setAttribute("aria-expanded", String(open));
  if (drawerScrim) drawerScrim.hidden = !open;
  document.body.classList.toggle("drawer-open", open);
  if (open) {
    languageMenu.hidden = true;
    languageMenuButton.setAttribute("aria-expanded", "false");
    closeMenuButton?.focus({ preventScroll: true });
  }
}

function toggleDrawerPanel(buttonId, panelId) {
  const button = document.querySelector(`#${buttonId}`);
  const panel = document.querySelector(`#${panelId}`);
  if (!button || !panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function syncLanguageUi() {
  document.documentElement.lang = currentLanguage;
  document.title = isPortalHost
    ? (currentLanguage === "es" ? "Registro de Filtros W.A.T.A." : "W.A.T.A. Filter Registry")
    : (currentLanguage === "es" ? "Centro Tecnológico W.A.T.A." : "W.A.T.A. Tech Hub");
  translateDom(document);
  if (state.session) setProfile();
  else {
    profileButton.querySelector("strong").textContent = translateText("Loading", currentLanguage);
    profileButton.querySelector("small").textContent = translateText("Checking access", currentLanguage);
  }
  applyTheme(currentTheme(), false);
  syncLanguageControl();
}

function applyLanguage(language, persist = true) {
  currentLanguage = normalizeLanguage(language);
  if (persist) localStorage.setItem("wata-language", currentLanguage);
  updateConnectionState(false);
  render();
}

function permittedPartnerIds() {
  return state.session?.allowedPartnerIds || [];
}

function scoped(items) {
  if (currentScope === "all") return items;
  return items.filter(item => (item.partners || [item.partner]).includes(currentScope));
}

function countryInfo(row) {
  const rawCode = String(row.countryCode || "").trim().toUpperCase();
  const aliases = { COL: "CO", GTM: "GT", MMR: "MM" };
  const text = `${row.country || ""} ${row.deployment || ""}`.toLowerCase();
  let code = aliases[rawCode] || (countryProfiles[rawCode] ? rawCode : "");
  if (!code && text.includes("colomb")) code = "CO";
  if (!code && text.includes("guatem")) code = "GT";
  if (!code && (text.includes("myanmar") || text.includes("burma"))) code = "MM";
  const known = countryProfiles[code];
  const name = row.country && row.country !== "Unknown" ? row.country : (known?.name || "Country not assigned");
  const flag = known?.flag || (code.length === 2 ? String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt())) : "🏳️");
  return { code: code || "unknown", name, flag, x: known?.x, y: known?.y };
}

function countryScoped(items) {
  const rows = scoped(items);
  return currentCountry === "all" ? rows : rows.filter(row => countryInfo(row).code === currentCountry);
}

function countryOptions(items) {
  const countries = new Map();
  for (const row of scoped(items)) {
    const info = countryInfo(row);
    const prior = countries.get(info.code) || { ...info, count: 0 };
    prior.count += 1;
    countries.set(info.code, prior);
  }
  return [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function countryFilters(items) {
  const countries = countryOptions(items);
  if (countries.length < 2 && !countries.some(country => country.code === "unknown")) return "";
  return `<div class="country-filters" role="group" aria-label="Filter by country">
    <button class="country-button country-flag ${currentCountry === "all" ? "active" : ""}" data-country="all" aria-label="Show all countries" title="All countries">🌍<span>${scoped(items).length}</span></button>
    ${countries.map(country => `<button class="country-button country-flag ${currentCountry === country.code ? "active" : ""}" data-country="${escapeHtml(country.code)}" aria-label="Show ${escapeHtml(country.name)}" title="${escapeHtml(country.name)}">${country.flag}<span>${country.count}</span></button>`).join("")}
  </div>`;
}

function partnerNames(row) {
  return (row.partners || [row.partner]).filter(Boolean).map(id => portalBranding[id]?.name || String(id).toUpperCase()).join(" + ") || "W.A.T.A.";
}

function contextCell(row) {
  const country = countryInfo(row);
  return `<td class="context-cell" data-label="Country / program"><strong>${country.flag} ${escapeHtml(country.name)}</strong><span>${display(row.deployment, "Deployment not assigned")}</span><small>${escapeHtml(partnerNames(row))}</small></td>`;
}

function partner() {
  return portalBranding[currentScope] || portalBranding.all;
}

function partnerDisplayName() {
  return translateText(partner().name, currentLanguage);
}

function partnerMark() {
  const active = partner();
  const logo = safeImageUrl(active.logo);
  if (logo) return `<span class="partner-mark"><img src="${escapeHtml(logo)}" alt="${escapeHtml(active.logoAlt || `${active.name} logo`)}"></span>`;
  return `<span class="partner-mark" aria-label="${escapeHtml(active.name)}">${escapeHtml(active.mark)}</span>`;
}

function safeImageUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, location.origin);
    return url.protocol === "https:" || url.origin === location.origin ? url.href : "";
  } catch {
    return "";
  }
}

function applyPartnerBrand() {
  document.documentElement.style.setProperty("--partner-accent", partner().accent);
  document.documentElement.style.setProperty("--partner-accent-soft", partner().accentSoft);
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("wata-theme", theme);
  const dark = theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.setAttribute("aria-label", translateText("Switch color theme", currentLanguage));
  themeToggle.querySelector(".theme-icon").textContent = dark ? "☾" : "☀";
  themeToggle.querySelector(".theme-label").textContent = currentLanguage === "es"
    ? `Modo ${translateText(dark ? "Dark" : "Light", currentLanguage).toLowerCase()}`
    : (dark ? "Dark" : "Light");
  themeToggle.querySelector(".theme-mode").textContent = currentLanguage === "es" ? "" : "mode";
  const appearanceLabel = themeToggle.querySelector("strong");
  if (appearanceLabel) appearanceLabel.textContent = translateText("Appearance", currentLanguage);
  const themeHelp = themeToggle.querySelector(".theme-help");
  if (themeHelp) themeHelp.textContent = translateText("Change app appearance", currentLanguage);
  document.querySelector('meta[name="theme-color"]').content = dark ? "#061226" : "#3052a4";
}

function setScopeOptions() {
  if (!scope) return;
  const allowed = permittedPartnerIds();
  scope.innerHTML = allowed.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(translateText(portalBranding[id]?.name || id.toUpperCase(), currentLanguage))}</option>`).join("");
  if (!allowed.includes(currentScope)) currentScope = allowed[0] || "all";
  scope.value = currentScope;
  scope.disabled = allowed.length < 2;
}

function setProfile() {
  if (!state.session) return;
  const name = state.session.name || "Portal user";
  const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  profileButton.querySelector(".avatar").textContent = initials;
  profileButton.querySelector("strong").textContent = name;
  const roleLabels = { founder: "W.A.T.A. Founder", app_user: "W.A.T.A. App User", wata_admin: "W.A.T.A. Admin", ambassador: "W.A.T.A. Ambassador", observer: "Observer · view only", partner_lead: "Partner Lead", team_member: "W.A.T.A. Team" };
  profileButton.querySelector("small").textContent = translateText(roleLabels[state.session.role] || "W.A.T.A. member", currentLanguage);
}

function sectionHeader(title, subtitle, action = "") {
  return `<div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>${action}</div>`;
}

function impactForScope() {
  const ids = currentScope === "all" ? Object.keys(state.impact) : [currentScope];
  return ids.reduce((total, id) => {
    const row = state.impact[id] || {};
    for (const key of ["families", "people", "communities", "surveys", "distributions", "dropoffs", "followups", "surveyors"]) total[key] += Number(row[key] || 0);
    return total;
  }, { families: 0, people: 0, communities: 0, surveys: 0, distributions: 0, dropoffs: 0, followups: 0, surveyors: 0 });
}

function stats() {
  const impact = impactForScope();
  const filterCount = scoped(state.filters).length;
  const issueCount = scoped(state.issues).length;
  return `<div class="stat-grid">
    <article class="stat"><span>Filters tracked</span><strong>${number(filterCount)}</strong><small>Asset Registry</small></article>
    <article class="stat"><span>Survey events</span><strong>${number(impact.surveys)}</strong><small>${number(impact.distributions)} distributions · ${number(impact.followups)} follow-ups</small></article>
    <article class="stat"><span>People reached</span><strong>${number(impact.people)}</strong><small>${number(impact.families)} recorded families</small></article>
    <article class="stat"><span>Open issues</span><strong>${number(issueCount)}</strong><small>${issueCount ? "Needs review" : "All clear"}</small></article>
  </div>`;
}

function portalView() {
  const generated = state.meta?.generatedAt ? `Updated ${date(state.meta.generatedAt)}` : "Live registry";
  const heroTitle = currentScope === "all" ? "Every filter, from distribution through follow-up." : `${partner().name} filter registry.`;
  return `<div class="hero">
    <div><p class="eyebrow">W.A.T.A. Filter Registry</p><h1>${escapeHtml(heroTitle)}</h1><p class="hero-copy">Track distributed filters, household reach, upcoming visits, and data-quality issues inside your authorized partner view.</p></div>
    <div class="sync-card"><span>Registry health</span><strong>${navigator.onLine ? "Connected" : "Offline"}</strong><small>${navigator.onLine ? `${escapeHtml(generated)} · Read-only` : "The app shell works offline; private data is not cached."}</small></div>
  </div>
  ${sectionHeader("Program at a glance", partner().name)}${stats()}
  ${sectionHeader("Open a registry view", "Everything here stays inside your approved partner and country scope.")}
  <div class="app-grid">
    <button class="app-card" data-view="map"><span class="app-icon">${icons.map}</span><h3>Filter Map</h3><p>See privacy-rounded filter locations and follow-up priorities inside your authorized view.</p><b>Open map →</b></button>
    <button class="app-card" data-view="filters"><span class="app-icon app-icon-image"><img src="assets/registry/icon-192.png" alt=""></span><h3>Water Filters</h3><p>Find each filter, family, community, status, and distribution date.</p><b>View filters →</b></button>
    <button class="app-card" data-view="followups"><span class="app-icon">${icons.followup}</span><h3>Follow-ups</h3><p>See completed visits, upcoming milestones, and overdue records.</p><b>View schedule →</b></button>
    <button class="app-card" data-view="impact"><span class="app-icon">${icons.impact}</span><h3>Impact</h3><p>Understand filters tracked, survey activity, and people reached.</p><b>View impact →</b></button>
    <button class="app-card" data-view="issues"><span class="app-icon">${icons.issue}</span><h3>Issues</h3><p>Find source-data problems using safe operational identifiers.</p><b>Review issues →</b></button>
  </div>`;
}

function toolIcon(tool) {
  const images = {
    watadex: "assets/watadex-icon-clean.svg",
    partner_portal: "assets/registry/icon-192.png",
    community: "assets/community-app-original.png",
    impact_map: "assets/impact-map-icon.svg",
    website: "assets/wata-website-icon.svg",
    field_kit: "assets/field-app-original.png",
    mwater: "assets/mwater-surveyor-icon.png"
  };
  if (images[tool.id]) return `<img src="${images[tool.id]}" alt="">`;
  return icons.hub;
}

function guideMenu(tool) {
  const guides = tool.guides || [];
  return `<details class="guide-menu"><summary>Instructions <span aria-hidden="true">⌄</span></summary><div class="guide-links">${guides.length
    ? guides.map(guide => `<a href="${escapeHtml(guide.url)}" target="_blank" rel="noopener noreferrer"><b>${escapeHtml(guide.format)}</b><span>${escapeHtml(guide.label)}</span></a>`).join("")
    : `<span class="guide-pending">PDF + PNG guide coming soon</span>`}</div></details>`;
}

function toolCard(tool) {
  const ready = tool.status === "ready";
  const openAction = tool.route
    ? `<button class="tool-open" data-view="${escapeHtml(tool.route)}">Open app <span>→</span></button>`
    : ready
      ? `<a class="tool-open" href="${escapeHtml(tool.url)}" target="_blank" rel="noopener noreferrer">Open app <span>↗</span></a>`
      : `<span class="tool-coming">App coming soon</span>`;
  return `<article class="tool-card hub-tool-card" data-tool="${escapeHtml(tool.id)}">
    <div class="tool-card-top"><span class="app-icon app-icon-image">${toolIcon(tool)}</span><span class="tool-status ${ready ? "ready" : ""}">${ready ? "Ready" : "Coming soon"}</span></div>
    <div><p class="tool-audience">${escapeHtml(tool.audience)}</p><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.description)}</p></div>
    <div class="tool-footer">${openAction}${guideMenu(tool)}</div>
  </article>`;
}

function hubHomeView() {
  const readyCount = state.tools.filter(tool => tool.status === "ready").length;
  return `<div class="hub-app-head" id="apps"><div><p class="eyebrow">Your apps</p><h1>Choose where you want to go.</h1></div><span>${readyCount} ready</span></div>
  <div class="tool-grid hub-tool-grid">${state.tools.map(toolCard).join("")}</div>`;
}

function commandCenterMetrics() {
  const rows = scoped(state.filters);
  const active = rows.filter(row => !isInventory(row));
  const people = rows.reduce((total, row) => total + Number(row.people || 0), 0);
  const today = todayKey();
  const sevenDays = new Date(dateValue(today) + (7 * 86400000)).toISOString().slice(0, 10);
  const dueSoon = active.filter(row => {
    const due = dateKey(row.followup);
    return due && due >= today && due <= sevenDays;
  });
  const scheduled = active.filter(row => dateKey(row.followup));
  const onTrack = scheduled.filter(row => lifecycleStatus(row).overdueDays === 0);
  return {
    active: active.length,
    total: rows.length,
    people,
    dueSoon: dueSoon.length,
    onTrackRate: scheduled.length ? Math.round((onTrack.length / scheduled.length) * 100) : null
  };
}

function commandCenterKpis() {
  const metrics = commandCenterMetrics();
  return `<div class="command-kpis" aria-label="Registry command center metrics">
    <button class="command-kpi" data-view="filters"><span>Active filters</span><strong>${number(metrics.active)} <small>/ ${number(metrics.total)}</small></strong><em>Open filter registry →</em></button>
    <article class="command-kpi"><span>People reached</span><strong>${number(metrics.people)}</strong><em>Current authorized scope</em></article>
    <button class="command-kpi warning" data-view="followups"><span>Follow-ups due · 7 days</span><strong>${number(metrics.dueSoon)}</strong><em>Open follow-up queue →</em></button>
    <button class="command-kpi ${metrics.onTrackRate === null || metrics.onTrackRate >= 80 ? "healthy" : "warning"}" data-view="followups"><span>On-track rate</span><strong>${metrics.onTrackRate === null ? "—" : `${number(metrics.onTrackRate)}<small>%</small>`}</strong><em>Scheduled active filters</em></button>
  </div>`;
}

function commandLifecyclePanel() {
  const rows = lifecycleRows().slice(0, 6);
  return `<section class="command-panel command-lifecycle">
    <div class="command-panel-head"><div><span class="command-panel-icon">${icons.followup}</span><div><h2>Filter lifecycle</h2><p>Newest installed filters on one shared calendar axis.</p></div></div><button class="link-button" data-view="followups" data-followup-target="lifecycles">View all lifecycles</button></div>
    <div class="lifecycle-workspace">${lifecycleWorkspace(rows)}</div>
  </section>`;
}

function commandFollowupQueue() {
  const today = todayKey();
  const rows = countryScoped(state.filters)
    .filter(row => !isInventory(row) && dateKey(row.followup))
    .sort((a, b) => dateValue(a.followup) - dateValue(b.followup) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 6);
  const items = rows.map(row => {
    const due = dateKey(row.followup);
    const overdue = due < today;
    const distance = overdue ? daysBetween(due, today) : daysBetween(today, due);
    const timing = overdue ? `${number(distance)} days overdue` : distance === 0 ? "Due today" : `Due in ${number(distance)} days`;
    return `<button class="command-queue-row" type="button" data-filter-id="${escapeHtml(row.recordId)}">
      <span class="command-queue-badge ${overdue ? "overdue" : distance <= 7 ? "soon" : ""}">${overdue ? "Overdue" : distance <= 7 ? "Soon" : "Scheduled"}</span>
      <span><strong>${display(row.family, "Family not assigned")}</strong><small>${display(row.id)} · ${countryInfo(row).flag} ${display(row.community)}</small></span>
      <span><strong>${date(due)}</strong><small>${escapeHtml(translateText(timing, currentLanguage))}</small></span>
    </button>`;
  }).join("");
  return `<section class="command-panel command-queue">
    <div class="command-panel-head"><div><span class="command-panel-icon">${icons.followup}</span><div><h2>Follow-up queue</h2><p>Overdue first, then the soonest scheduled visit.</p></div></div><button class="link-button" data-view="followups">View schedule</button></div>
    <div class="command-queue-list">${items || `<div class="empty-state">No scheduled follow-ups in this view.</div>`}</div>
  </section>`;
}

function commandImpactPanel() {
  const impact = impactForScope();
  const metrics = [
    { label: "Distribution events", value: Number(impact.distributions || 0), tone: "water" },
    { label: "Follow-up events", value: Number(impact.followups || 0), tone: "blue" },
    { label: "Families recorded", value: Number(impact.families || 0), tone: "green" },
    { label: "People reached", value: Number(impact.people || 0), tone: "cyan" }
  ];
  const maximum = Math.max(1, ...metrics.map(metric => metric.value));
  return `<section class="command-panel command-impact">
    <div class="command-panel-head"><div><span class="command-panel-icon">${icons.impact}</span><div><h2>Health & water trends</h2><p>Current Registry indicators. Trend-over-time data is not available yet.</p></div></div><button class="link-button" data-view="impact">Open impact</button></div>
    <div class="command-impact-chart" role="img" aria-label="Current Registry impact totals">${metrics.map(metric => `<div class="command-impact-row"><span>${translateText(metric.label, currentLanguage)}</span><i><b class="${metric.tone}" style="--width:${Math.max(2, (metric.value / maximum) * 100)}%"></b></i><strong>${number(metric.value)}</strong></div>`).join("")}</div>
  </section>`;
}

function commandCenterHomeView() {
  const generated = state.meta?.generatedAt ? `Updated ${date(state.meta.generatedAt)}` : "Live registry";
  return `<div class="command-head">
    <div><p class="eyebrow">W.A.T.A. Filter Registry</p><h1>Command Center</h1><p>Operational visibility across ${escapeHtml(partnerDisplayName())}.</p></div>
    <div class="command-sync"><span class="status-dot ${navigator.onLine ? "connected" : ""}"></span><div><strong>${navigator.onLine ? "Registry connected" : "Registry offline"}</strong><small>${navigator.onLine ? `${escapeHtml(generated)} · Read-only` : "Private Registry data is never cached offline."}</small></div></div>
  </div>
  ${commandCenterKpis()}
  <div class="command-main-grid">${commandLifecyclePanel()}${commandFollowupQueue()}</div>
  ${commandImpactPanel()}`;
}

function homeView() {
  return isPortalHost ? commandCenterHomeView() : hubHomeView();
}

function syncHubNavigation() {
  if (isPortalHost) return;
  const quickLinks = document.querySelector("#hubQuickLinks");
  if (quickLinks) quickLinks.innerHTML = state.tools.map(tool => {
    const ready = tool.status === "ready";
    const tag = ready ? "a" : "span";
    const href = ready ? ` href="${escapeHtml(tool.route ? `#${tool.route}` : tool.url)}"${tool.route ? "" : ' target="_blank" rel="noopener noreferrer"'}` : "";
    return `<${tag} class="hub-quick-link ${ready ? "" : "disabled"}"${href}><span class="mini-tool-icon">${toolIcon(tool)}</span><span>${escapeHtml(tool.name)}</span></${tag}>`;
  }).join("");
  const guideList = document.querySelector("#menuGuideList");
  if (guideList) guideList.innerHTML = state.tools.map(tool => {
    const guides = tool.guides || [];
    return `<div class="menu-guide-row"><strong>${escapeHtml(tool.name)}</strong><span>${guides.length ? guides.map(guide => `<a href="${escapeHtml(guide.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(guide.format)}</a>`).join("") : "Guide coming soon"}</span></div>`;
  }).join("");
}

function globalImpactMap() {
  return `<div class="historical-impact-note" role="note">
    <strong>Historical impact context</strong>
    <span>This organization-wide map includes documented distributions completed before W.A.T.A.'s current survey and Filter Registry systems were in place. Its totals may therefore differ from the survey-backed partner metrics above.</span>
  </div>
  <div class="global-impact-map">
    <iframe src="https://map.cleanwata.org/" title="Interactive W.A.T.A. global impact map" loading="lazy" referrerpolicy="no-referrer"></iframe>
    <a href="https://map.cleanwata.org/" target="_blank" rel="noopener noreferrer">Open the full impact map ↗</a>
  </div>`;
}

function isInventory(row) {
  const status = String(row.status || "").toLowerCase();
  return status.includes("drop") || status.includes("inventory") || status.includes("unassigned") || status.includes("not assigned");
}

function hasOpenIssue(row) {
  const filterIds = new Set([row.recordId, row.id].filter(Boolean).map(value => String(value).trim().toLowerCase()));
  return scoped(state.issues).some(issue => {
    const status = String(issue.status || "").toLowerCase();
    const linked = String(issue.filter || "").trim().toLowerCase();
    return linked && filterIds.has(linked) && !status.includes("closed") && !status.includes("resolved");
  });
}

function mapMarkerState(row) {
  const status = String(row.status || "").toLowerCase();
  const followupStatus = String(row.followupStatus || "").toLowerCase();
  const today = new Date();
  const dueSoon = new Date(today);
  dueSoon.setDate(dueSoon.getDate() + 30);
  const dateKey = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const dueKey = String(row.followup || "").slice(0, 10);
  if (isInventory(row)) return { key: "inventory", label: "In inventory", color: "#8295a0", priority: 1 };
  if (hasOpenIssue(row)) return { key: "issue", label: "Data issue", color: "#f2c94c", priority: 6 };
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueKey) && dueKey < dateKey(today)) return { key: "overdue", label: "Missing follow-up", color: "#ed8624", priority: 5 };
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueKey) && dueKey <= dateKey(dueSoon)) return { key: "due-soon", label: "Follow-up due soon", color: "#e3b72f", priority: 4 };
  if (row.lastFollowup || followupStatus.includes("complete") || followupStatus.includes("current")) return { key: "current", label: "Followed up", color: "#367ee8", priority: 3 };
  return { key: "distributed", label: "Distributed", color: "#2fb785", priority: 2 };
}

function mappableRows() {
  return countryScoped(state.filters).filter(row => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

function mapView() {
  const visibleRows = countryScoped(state.filters);
  const mapped = mappableRows();
  const missing = visibleRows.length - mapped.length;
  const counts = mapped.reduce((result, row) => {
    result[mapMarkerState(row).key] += 1;
    return result;
  }, { distributed: 0, current: 0, "due-soon": 0, overdue: 0, issue: 0, inventory: 0 });
  return `${sectionHeader("Filter map", `${number(mapped.length)} mapped filters in ${partnerDisplayName()}`)}
    <div class="notice"><b>Privacy-safe operational map</b><span>Locations are rounded to roughly a neighborhood scale. Records without validated installation coordinates are counted below but never guessed.</span></div>
    <div class="panel map-panel">
      <div class="map-toolbar">${countryFilters(state.filters)}<div class="map-coverage"><strong>${number(mapped.length)}</strong><span>mapped</span><strong>${number(missing)}</strong><span>missing coordinates</span></div></div>
      <div class="map-legend" aria-label="Map legend">
        <span><i style="--marker:#2fb785"></i>Distributed <b>${number(counts.distributed)}</b></span>
        <span><i style="--marker:#367ee8"></i>Followed up <b>${number(counts.current)}</b></span>
        <span><i style="--marker:#e3b72f"></i>Due soon <b>${number(counts["due-soon"])}</b></span>
        <span><i style="--marker:#ed8624"></i>Missing follow-up <b>${number(counts.overdue)}</b></span>
        <span><i style="--marker:#f2c94c"></i>Data issue <b>${number(counts.issue)}</b></span>
        <span><i style="--marker:#8295a0"></i>In inventory <b>${number(counts.inventory)}</b></span>
      </div>
      <div id="registryMap" class="registry-map" role="region" aria-label="Interactive map of authorized water filters"><div class="map-loading">Loading secure map…</div></div>
      <p class="map-footnote">Colors show each filter\'s current operational state, not historical survey totals. Map tiles require an internet connection. Filter records and permissions remain read-only and come from Airtable.</p>
    </div>`;
}

function mapFallback(message) {
  const container = document.querySelector("#registryMap");
  if (container) container.innerHTML = `<div class="map-empty"><strong>${escapeHtml(translateText("Map unavailable", currentLanguage))}</strong><span>${escapeHtml(translateText(message, currentLanguage))}</span></div>`;
}

function mountRegistryMap() {
  const container = document.querySelector("#registryMap");
  if (!container) return;
  if (!navigator.onLine) { mapFallback("Reconnect to load the basemap. Your authorized counts remain visible above."); return; }
  if (!window.L) { mapFallback("The map library could not load. Refresh when connected."); return; }
  const rows = mappableRows();
  container.replaceChildren();
  registryMap = window.L.map(container, { zoomControl: true, scrollWheelZoom: false });
  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
  }).addTo(registryMap);

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.latitude},${row.longitude}`;
    const group = groups.get(key) || { latitude: row.latitude, longitude: row.longitude, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const bounds = [];
  for (const group of groups.values()) {
    const markerState = group.rows.map(mapMarkerState).sort((a, b) => b.priority - a.priority)[0];
    const radius = Math.min(18, 7 + Math.log2(group.rows.length) * 2.2);
    const communities = [...new Set(group.rows.map(row => row.community).filter(Boolean))];
    const deployments = [...new Set(group.rows.map(row => row.deployment).filter(Boolean))];
    const links = group.rows.slice(0, 6).map(row => `<button type="button" class="map-record-link" data-filter-id="${escapeHtml(row.recordId)}">${escapeHtml(row.id)}</button>`).join("");
    const more = group.rows.length > 6 ? `<span class="map-more">+${group.rows.length - 6} more</span>` : "";
    window.L.circleMarker([group.latitude, group.longitude], {
      radius, color: "#ffffff", weight: 2, fillColor: markerState.color, fillOpacity: 0.9
    }).addTo(registryMap).bindPopup(`<div class="map-popup"><strong>${group.rows.length === 1 ? escapeHtml(group.rows[0].id) : escapeHtml(translateText(`${group.rows.length} filters at this location`, currentLanguage))}</strong><span>${escapeHtml(translateText(markerState.label, currentLanguage))}</span><span>${escapeHtml(translateText(communities.slice(0, 2).join(" · ") || "Community not assigned", currentLanguage))}</span><small>${escapeHtml(translateText(deployments.slice(0, 2).join(" · ") || "Deployment not assigned", currentLanguage))}</small><div>${links}${more}</div></div>`);
    bounds.push([group.latitude, group.longitude]);
  }
  if (bounds.length) {
    registryMap.fitBounds(bounds, { padding: [34, 34], maxZoom: 13 });
  } else {
    const selected = currentCountry !== "all" ? countryProfiles[currentCountry] : null;
    registryMap.setView(selected?.center || [12, -79], selected?.zoom || 3);
    container.insertAdjacentHTML("beforeend", `<div class="map-zero">${escapeHtml(translateText("No validated installation coordinates match this partner and country selection.", currentLanguage))}</div>`);
  }
  setTimeout(() => registryMap?.invalidateSize(), 0);
}

function impactView() {
  const impact = impactForScope();
  return `<div class="partner-summary">${partnerMark()}<div><h2>${escapeHtml(partnerDisplayName())}</h2><p>${escapeHtml(translateText(partner().subtitle, currentLanguage))} · Authorized operating view</p></div></div>
    ${sectionHeader("Impact dashboard", "Live summaries from the W.A.T.A. Filter Registry.")}${stats()}
    ${sectionHeader("Program details", "Operational totals for the selected partner scope.")}
    <div class="stat-grid">
      <article class="stat"><span>Communities</span><strong>${number(impact.communities)}</strong><small>Recorded communities</small></article>
      <article class="stat"><span>Active surveyors</span><strong>${number(impact.surveyors)}</strong><small>Current field team</small></article>
      <article class="stat"><span>Distribution surveys</span><strong>${number(impact.distributions)}</strong><small>Recorded events</small></article>
      <article class="stat"><span>Follow-up surveys</span><strong>${number(impact.followups)}</strong><small>Recorded events</small></article>
    </div>
    ${sectionHeader("Global impact map", "Organization-wide historical footprint · not limited to the selected partner scope.")}
    ${globalImpactMap()}
    ${sectionHeader("What needs attention", "Portal-visible data-quality and follow-up signals.", `<button class="link-button" data-view="issues">Review issues</button>`)}
    ${issuesTable(scoped(state.issues).slice(0, 5), false)}`;
}

function statusClass(status) {
  const normalized = String(status).toLowerCase();
  if (normalized.includes("issue") || normalized.includes("blocked")) return "red";
  if (normalized.includes("due") || normalized.includes("pending") || normalized.includes("review")) return "amber";
  return "";
}

function filterRows(rows) {
  return rows.length ? rows.map(row => `<tr class="clickable-row" data-filter-id="${escapeHtml(row.recordId)}" tabindex="0">
    <td class="id" data-label="Filter ID"><button class="record-link" data-filter-id="${escapeHtml(row.recordId)}">${display(row.id)}</button></td>
    ${contextCell(row)}<td data-label="Community">${display(row.community)}</td><td data-label="Family">${display(row.family)}</td>
    <td data-label="People">${row.people || "—"}</td><td data-label="Status"><span class="pill ${statusClass(row.status)}">${display(row.status)}</span></td>
    <td data-label="Distribution date">${date(row.distributed)}</td><td data-label="Next follow-up">${date(row.followup)}</td>
  </tr>`).join("") : `<tr><td colspan="8" class="empty-state">No filters match this partner and country selection.</td></tr>`;
}

function filtersView() {
  const rows = countryScoped(state.filters);
  return `${sectionHeader("Water filters", `${number(rows.length)} Asset Registry records in ${partnerDisplayName()}`)}
    <div class="notice"><b>Authorized Registry view</b><span>Approved partner leads can see household names and household size for their records. Health responses remain excluded.</span></div>
    <div class="panel"><div class="table-tools"><input class="search" id="filterSearch" type="search" placeholder="Search filter, country, deployment, community, or family">${countryFilters(state.filters)}</div><div class="table-scroll"><table><thead><tr><th>Filter ID</th><th>Country / program</th><th>Community</th><th>Family</th><th>People</th><th>Status</th><th>Distribution date</th><th>Next follow-up</th></tr></thead><tbody id="filterRows">${filterRows(rows)}</tbody></table></div></div>`;
}

function field(label, value, isDate = false) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${isDate ? date(value) : display(value)}</dd></div>`;
}

function lifecycleEvents(row) {
  const events = (Array.isArray(row.events) ? row.events : [])
    .filter(event => dateKey(event.date) && ["Distribution", "Follow-Up", "Drop-Off"].includes(event.type))
    .map(event => ({ ...event, date: dateKey(event.date) }));
  const hasDistribution = events.some(event => event.type === "Distribution");
  if (!hasDistribution && !isInventory(row) && dateKey(row.distributed)) events.push({ recordId: `derived-install-${row.recordId}`, date: dateKey(row.distributed), type: "Distribution", derived: true });
  const hasLatestFollowup = events.some(event => event.type === "Follow-Up" && event.date === dateKey(row.lastFollowup));
  if (!hasLatestFollowup && dateKey(row.lastFollowup)) events.push({ recordId: `derived-followup-${row.recordId}`, date: dateKey(row.lastFollowup), type: "Follow-Up", derived: true });
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.recordId.localeCompare(b.recordId));
}

function lifecycleEventLabel(event, followupNumber = 0) {
  if (event.type === "Distribution") return translateText("Installed", currentLanguage);
  if (event.type === "Drop-Off") return translateText("Drop-off", currentLanguage);
  return `${translateText("Follow-up", currentLanguage)} ${followupNumber}`;
}

function lifecycleDomain(rows) {
  const dates = rows.flatMap(row => [...lifecycleEvents(row).map(event => event.date), dateKey(row.followup)].filter(Boolean));
  dates.push(todayKey());
  let start = Math.min(...dates.map(dateValue).filter(Number.isFinite));
  let end = Math.max(...dates.map(dateValue).filter(Number.isFinite));
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    end = dateValue(todayKey());
    start = end - 365 * 86400000;
  }
  if (end - start < 60 * 86400000) start = end - 60 * 86400000;
  return { start, end, span: Math.max(1, end - start) };
}

function timelinePosition(value, domain) {
  const timestamp = dateValue(value);
  const raw = Number.isFinite(timestamp) ? ((timestamp - domain.start) / domain.span) * 100 : 0;
  return Math.max(1.5, Math.min(98.5, raw));
}

function lifecycleStatus(row) {
  const events = lifecycleEvents(row);
  const followups = events.filter(event => event.type === "Follow-Up");
  const last = followups.at(-1) || events.at(-1);
  const inventory = isInventory(row);
  const due = inventory ? "" : dateKey(row.followup);
  const overdueDays = due && due < todayKey() ? daysBetween(due, todayKey()) : 0;
  return { events, followups, last, due, overdueDays, inventory };
}

function lifecycleRow(row, domain, compact = false) {
  const { events, followups, last, due, overdueDays, inventory } = lifecycleStatus(row);
  let followupNumber = 0;
  const markers = events.map(event => {
    if (event.type === "Follow-Up") followupNumber += 1;
    const label = lifecycleEventLabel(event, followupNumber);
    const position = timelinePosition(event.date, domain);
    return `<button type="button" class="lifecycle-marker ${event.type.toLowerCase().replace(/[^a-z]+/g, "-")}" style="--position:${position}%" data-filter-id="${escapeHtml(row.recordId)}" aria-label="${escapeHtml(`${label}: ${date(event.date)}`)}" title="${escapeHtml(`${label} · ${date(event.date)}`)}"><span></span></button>`;
  }).join("");
  const segments = events.slice(1).map((event, index) => {
    const previous = events[index];
    const start = timelinePosition(previous.date, domain);
    const end = timelinePosition(event.date, domain);
    const duration = daysBetween(previous.date, event.date);
    return `<span class="lifecycle-segment completed" style="--start:${start}%;--width:${Math.max(0, end - start)}%"><b>${number(duration)}d</b></span>`;
  }).join("");
  const dueAfterLast = due && (!last || dateValue(due) > dateValue(last.date));
  const dueStart = last ? timelinePosition(last.date, domain) : timelinePosition(due, domain);
  const dueEnd = timelinePosition(due, domain);
  const dueMarker = dueAfterLast ? `<span class="lifecycle-segment scheduled ${overdueDays ? "overdue" : ""}" style="--start:${dueStart}%;--width:${Math.max(0, dueEnd - dueStart)}%"></span><button type="button" class="lifecycle-marker due ${overdueDays ? "overdue" : ""}" style="--position:${dueEnd}%" data-filter-id="${escapeHtml(row.recordId)}" aria-label="${escapeHtml(`${translateText(overdueDays ? "Overdue milestone" : "Next milestone", currentLanguage)}: ${date(due)}`)}" title="${escapeHtml(`${translateText(overdueDays ? "Overdue milestone" : "Next milestone", currentLanguage)} · ${date(due)}`)}"><span></span></button>` : "";
  const todayPosition = timelinePosition(todayKey(), domain);
  const elapsed = last ? Math.max(0, daysBetween(last.date, todayKey())) : 0;
  const activityLabel = inventory ? translateText("In inventory", currentLanguage) : followups.length
    ? `${number(elapsed)} ${translateText("days since follow-up", currentLanguage)}`
    : last ? `${number(elapsed)} ${translateText("days since installation", currentLanguage)}` : translateText("No dated activity", currentLanguage);
  const secondary = inventory ? translateText("Not installed", currentLanguage) : overdueDays
    ? `${number(overdueDays)} ${translateText("days overdue", currentLanguage)}`
    : followups.length ? `${number(followups.length)} ${translateText(followups.length === 1 ? "follow-up completed" : "follow-ups completed", currentLanguage)}` : translateText("Never followed up", currentLanguage);
  return `<article class="lifecycle-row ${compact ? "compact" : ""} ${inventory ? "inventory" : ""}" data-lifecycle-filter="${escapeHtml(row.recordId)}">
    <button class="lifecycle-identity" data-filter-id="${escapeHtml(row.recordId)}"><strong>${display(row.id)}</strong><span>${countryInfo(row).flag} ${display(row.community)}</span><small>${display(row.deployment)}</small></button>
    <div class="lifecycle-track" aria-label="${escapeHtml(`${row.id} lifecycle`)}"><span class="lifecycle-baseline"></span><span class="lifecycle-today" style="--position:${todayPosition}%" aria-hidden="true"></span>${segments}${dueMarker}${markers}</div>
    <div class="lifecycle-recency ${overdueDays ? "overdue" : ""} ${inventory ? "inventory" : ""}"><strong>${activityLabel}</strong><span>${secondary}</span></div>
  </article>`;
}

function lifecycleMini(row) {
  const events = lifecycleEvents(row);
  const domain = lifecycleDomain([row]);
  const followupEvents = events.filter(event => event.type === "Follow-Up");
  return `<div class="lifecycle-mini">${lifecycleRow(row, domain, true)}<ol class="timeline lifecycle-list">${events.length ? events.map(event => {
    const index = event.type === "Follow-Up" ? followupEvents.indexOf(event) + 1 : 0;
    return `<li><strong>${escapeHtml(lifecycleEventLabel(event, index))}</strong><span>${date(event.date)}</span></li>`;
  }).join("") : `<li><strong>${escapeHtml(translateText("No dated activity", currentLanguage))}</strong></li>`}<li class="scheduled"><strong>${escapeHtml(translateText("Next follow-up due", currentLanguage))}</strong><span>${date(row.followup)} · ${display(row.ambassador)}</span></li></ol></div>`;
}

function filterDetailView() {
  const row = scoped(state.filters).find(item => item.recordId === selectedFilterId);
  if (!row) return `<button class="back-button" data-view="filters" aria-label="Back to filters"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><div class="empty-state">This filter is not available in your authorized partner scope.</div>`;
  const partnerName = (row.partners || [row.partner]).map(id => portalBranding[id]?.name || "W.A.T.A.").join(" + ");
  return `<div class="detail-head">
      <button class="back-button" data-view="filters" aria-label="Back to filters"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/><path d="M8 12h11"/></svg></button>
      <div><p class="eyebrow">Water filter record</p><h1>${display(row.id)}</h1><p>${display(row.family)} · ${display(row.community)}</p></div>
      <span class="pill ${statusClass(row.status)}">${display(row.status)}</span>
    </div>
    <div class="notice"><b>Authorized Registry record</b><span>Operational household and field details are shown; health responses are excluded.</span></div>
    <div class="detail-grid">
      <article class="detail-card"><h3>Filter & program</h3><dl class="detail-list">${field("Filter ID", row.id)}${field("Country", `${countryInfo(row).flag} ${countryInfo(row).name}`)}${field("Partner", partnerName)}${field("Deployment", row.deployment)}${field("Status", row.status)}${field("Scope check", row.scopeStatus)}</dl></article>
      <article class="detail-card"><h3>Household</h3><dl class="detail-list">${field("Family", row.family)}${field("Household code", row.householdCode)}${field("People", row.people || "—")}${field("Community", row.community)}</dl></article>
      <article class="detail-card"><h3>Field ownership</h3><dl class="detail-list">${field("Ambassador", row.ambassador)}${field("Installed by", row.surveyor)}${field("Distribution date", row.distributed, true)}${field("Follow-up status", row.followupStatus)}</dl></article>
      <article class="detail-card wide-card"><h3>Filter lifecycle</h3>${lifecycleMini(row)}</article>
    </div>`;
}

function lifecycleRows() {
  const term = lifecycleSearch.trim().toLowerCase();
  const rows = countryScoped(state.filters).filter(row => `${row.id} ${row.country} ${row.deployment} ${row.community} ${row.family}`.toLowerCase().includes(term));
  return rows.sort((a, b) => {
    const inventoryOrder = Number(isInventory(a)) - Number(isInventory(b));
    if (inventoryOrder) return inventoryOrder;
    const aInstalled = Number.isFinite(dateValue(a.distributed)) ? dateValue(a.distributed) : -Infinity;
    const bInstalled = Number.isFinite(dateValue(b.distributed)) ? dateValue(b.distributed) : -Infinity;
    if (lifecycleSort === "newest") return bInstalled - aInstalled || a.id.localeCompare(b.id);
    if (lifecycleSort === "oldest") return aInstalled - bInstalled || a.id.localeCompare(b.id);
    if (lifecycleSort === "filter") return a.id.localeCompare(b.id);
    const aStatus = lifecycleStatus(a);
    const bStatus = lifecycleStatus(b);
    return bStatus.overdueDays - aStatus.overdueDays || dateValue(a.followup) - dateValue(b.followup) || a.id.localeCompare(b.id);
  });
}

function lifecycleWorkspace(rows = lifecycleRows()) {
  if (!rows.length) return `<div class="empty-state">No filters match this partner, country, and search selection.</div>`;
  const domain = lifecycleDomain(rows);
  const todayPosition = timelinePosition(todayKey(), domain);
  return `<div class="lifecycle-axis"><span>${date(new Date(domain.start).toISOString())}</span><strong><span class="lifecycle-axis-title">${translateText("Filter lifecycle", currentLanguage)}</span><i style="--position:${todayPosition}%">Today</i></strong><span>${date(new Date(domain.end).toISOString())}</span></div>
    <div class="lifecycle-column-head"><span>Filter & community</span><span>Recorded events and next milestone</span><span>Last activity</span></div>
    <div class="lifecycle-rows">${rows.map(row => lifecycleRow(row, domain)).join("")}</div>`;
}

function followupsView() {
  const rows = countryScoped(state.filters).filter(row => row.followup || row.followupStatus);
  const tabs = `<div class="view-switcher" role="group" aria-label="Follow-up view"><button class="${followupMode === "schedule" ? "active" : ""}" data-followup-mode="schedule">Schedule</button><button class="${followupMode === "lifecycles" ? "active" : ""}" data-followup-mode="lifecycles">Lifecycles</button></div>`;
  if (followupMode === "lifecycles") return `${sectionHeader("Filter lifecycles", `${number(lifecycleRows().length)} filters across a shared operational timeline.`, tabs)}
    <div class="notice lifecycle-notice"><b>How to read this</b><span>Every row uses the same calendar axis: newer events appear farther right. Solid dots are recorded field events, the vertical line is today, and hollow dots are scheduled milestones. Inventory records stay at the bottom and are never marked overdue.</span></div>
    <div class="panel lifecycle-panel"><div class="table-tools lifecycle-tools"><input class="search" id="lifecycleSearch" type="search" value="${escapeHtml(lifecycleSearch)}" placeholder="Search filter, deployment, community, or family"><select id="lifecycleSort" aria-label="Sort lifecycles"><option value="urgent" ${lifecycleSort === "urgent" ? "selected" : ""}>Most urgent</option><option value="newest" ${lifecycleSort === "newest" ? "selected" : ""}>Newest installed</option><option value="oldest" ${lifecycleSort === "oldest" ? "selected" : ""}>Oldest installed</option><option value="filter" ${lifecycleSort === "filter" ? "selected" : ""}>Filter ID</option></select>${countryFilters(state.filters)}</div><div id="lifecycleWorkspace" class="lifecycle-workspace">${lifecycleWorkspace()}</div></div>`;
  return `${sectionHeader("Follow-up schedule", `${number(rows.length)} filter records with follow-up information.`, tabs)}
    <div class="panel"><div class="table-tools">${countryFilters(state.filters)}</div><div class="table-scroll"><table><thead><tr><th>Filter ID</th><th>Country / program</th><th>Community</th><th>Last follow-up</th><th>Next follow-up</th><th>Status</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr class="clickable-row" data-filter-id="${escapeHtml(row.recordId)}"><td class="id" data-label="Filter ID">${display(row.id)}</td>${contextCell(row)}<td data-label="Community">${display(row.community)}</td><td data-label="Last follow-up">${date(row.lastFollowup)}</td><td data-label="Next follow-up">${date(row.followup)}</td><td data-label="Status"><span class="pill ${statusClass(row.followupStatus)}">${display(row.followupStatus)}</span></td></tr>`).join("") : `<tr><td colspan="6" class="empty-state">No follow-up records match this partner and country selection.</td></tr>`}</tbody></table></div></div>`;
}

function issuesTable(rows, controls = true) {
  return `<div class="panel">${controls ? `<div class="table-tools">${countryFilters(state.issues)}</div>` : ""}<div class="table-scroll"><table><thead><tr><th>Issue ID</th><th>Country / program</th><th>Problem</th><th>Filter</th><th>Source</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows.length ? rows.map(row => {
    const issueStatus = String(row.status || "").toLowerCase();
    const statusTone = !issueStatus.includes("closed") && !issueStatus.includes("resolved") ? "issue-open" : statusClass(`${row.priority} ${row.status}`);
    return `<tr><td class="id" data-label="Issue ID">${display(row.id)}</td>${contextCell(row)}<td data-label="Problem">${display(row.type)}</td><td data-label="Filter">${display(row.filter)}</td><td data-label="Source">${display(row.source)}</td><td data-label="Date">${date(row.date)}</td><td data-label="Status"><span class="pill ${statusTone}">${display(row.status)}</span></td></tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-state">No portal-visible issues match this partner and country selection.</td></tr>`}</tbody></table></div></div>`;
}

function issuesView() {
  const rows = countryScoped(state.issues);
  return `${sectionHeader("Data-quality issues", `${number(rows.length)} portal-visible issues · operational IDs only`)}
    <div class="notice"><b>Designed for action</b><span>Issues show the affected filter, survey type, date, and status without exposing health responses.</span></div>${issuesTable(rows)}`;
}

function settingsView() {
  if (!isPortalHost) return `<div class="hub-app-head"><div><p class="eyebrow">Tech Hub</p><h1>Settings & help</h1></div></div>
    <div class="help-grid">
      <article class="help-card"><span>01</span><h3>Your access</h3><p>Your active Airtable App Access record and its checkboxes control exactly which apps appear. Surveyors remains separate for Filter Registry scope.</p></article>
      <article class="help-card"><span>02</span><h3>Instructions</h3><p>Open the hamburger menu and choose Instructions for each app's latest PDF and share-ready PNG files.</p></article>
      <article class="help-card"><span>03</span><h3>App updates</h3><p>When an app guide is replaced in the W.A.T.A. source catalog, the next Hub release publishes the matching PDF and PNG automatically.</p></article>
      <article class="help-card"><span>04</span><h3>Coming soon</h3><p>Community App and Field Kit stay visible as roadmap items but will not send you to a guessed or unfinished destination.</p></article>
    </div>
    <button class="retry-button" data-view="home">Back to your apps</button>`;
  return `<div class="partner-summary">${partnerMark()}<div><h2>Settings & help</h2><p>${escapeHtml(partnerDisplayName())} · Registry guide</p></div></div>
    ${sectionHeader("How the Registry works", "A practical guide to navigating and interpreting the W.A.T.A. Filter Registry.")}
    <div class="help-grid">
      <article class="help-card"><span>01</span><h3>Choose a view</h3><p>W.A.T.A. admins and all-scope observers can switch between All W.A.T.A. and individual partners at the top. Partner leads and scoped observers only see the organizations approved for their Airtable email.</p></article>
      <article class="help-card"><span>02</span><h3>Filter by country</h3><p>Use the flag buttons on Map, Filters, Follow-ups, and Issues. “All” combines every country inside your authorized partner view.</p></article>
      <article class="help-card"><span>03</span><h3>Open a filter</h3><p>Select a Filter ID for its household, deployment, field ownership, and follow-up timeline. Health survey responses are never shown here.</p></article>
      <article class="help-card"><span>04</span><h3>Read follow-ups</h3><p>Overdue means the scheduled milestone has passed—not that the filter disappears. A late visit still counts as the next completed follow-up, and Airtable calculates the following milestone.</p></article>
      <article class="help-card"><span>05</span><h3>Resolve issues</h3><p>Issues are action signals from the source data. Use the operational IDs, survey type, deployment, surveyor, and date to find and correct the source record.</p></article>
      <article class="help-card"><span>06</span><h3>Understand updates</h3><p>mWater is the raw field source. Airtable is the registry and permissions source. The Registry is read-only and reflects Airtable after the ingestion workflow runs.</p></article>
    </div>
    ${sectionHeader("Access & privacy", "Why the email-code screen appears and what partners can see.")}
    <div class="detail-grid">
      <article class="detail-card"><h3>Secure sign-in</h3><p class="help-copy">The W.A.T.A. verification screen uses Cloudflare Access to protect the Registry. Enter the email approved in Airtable and use the one-time code; no Cloudflare account is required.</p></article>
      <article class="detail-card"><h3>Airtable controls access</h3><p class="help-copy">Email, Active status, Lead/Admin/Observer role, Team, and Portal Access determine the view. Changing those fields changes access without changing portal code.</p></article>
      <article class="detail-card"><h3>Read-only by design</h3><p class="help-copy">The Registry does not edit mWater or Airtable. The Filter Map only uses validated installation coordinates rounded to roughly a neighborhood scale; records without safe coordinates are not placed on the map.</p></article>
    </div>`;
}

function loadingView() {
  return `<div class="hero"><div><p class="eyebrow">Secure W.A.T.A. Filter Registry</p><h1>Preparing your Registry view.</h1><p class="hero-copy">Confirming your identity and authorized partner scope before loading Registry data.</p></div></div>`;
}

function errorView() {
  const forbidden = state.error?.status === 401 || state.error?.status === 403;
  const accessHelp = isPortalHost
    ? "Use the email approved for Registry access. If this email should be enabled, contact your W.A.T.A. administrator."
    : "Confirm that your Airtable App Access record has a unique email, Active status, Tech Hub checked, and at least one app enabled.";
  const eyebrow = isPortalHost && forbidden ? "Registry access" : forbidden ? "App access" : "Connection";
  const title = forbidden
    ? (isPortalHost ? "This email is not enabled for Registry access." : "Your W.A.T.A. access is not enabled yet.")
    : (isPortalHost ? "The Filter Registry is temporarily unavailable." : "The W.A.T.A. app is temporarily unavailable.");
  return `<div class="hero"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="hero-copy">${forbidden ? accessHelp : "No records were changed. Try again after the connection is restored."}</p><button class="retry-button" id="retryButton">Try again</button></div></div>`;
}

const portalViews = new Set(["home", "portal", "map", "impact", "filters", "filter-detail", "followups", "issues"]);

function syncChrome() {
  const hasPortal = isPortalHost && Boolean(state.session?.portalEnabled);
  document.querySelectorAll("[data-portal-only]").forEach(element => { element.hidden = !hasPortal; });
  const scopeWrap = document.querySelector(".scope-wrap");
  if (scopeWrap) scopeWrap.hidden = !hasPortal || currentView === "settings" || (!isPortalHost && currentView === "home");
}

function render() {
  if (registryMap) { registryMap.remove(); registryMap = null; }
  if (state.loading) { app.innerHTML = loadingView(); syncLanguageUi(); return; }
  if (state.error) { app.innerHTML = errorView(); document.querySelector("#retryButton")?.addEventListener("click", loadPortal); syncLanguageUi(); return; }
  const views = { home: homeView, portal: portalView, map: mapView, impact: impactView, filters: filtersView, "filter-detail": filterDetailView, followups: followupsView, issues: issuesView, settings: settingsView };
  if (!isPortalHost && currentView !== "settings") currentView = "home";
  if (!state.session?.portalEnabled && portalViews.has(currentView)) currentView = "home";
  if (!views[currentView]) currentView = "home";
  applyPartnerBrand();
  app.innerHTML = views[currentView]();
  syncChrome();
  syncHubNavigation();
  const activeView = currentView === "filter-detail" ? "filters" : currentView;
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === activeView));
  document.querySelector("#filterSearch")?.addEventListener("input", event => {
    const term = event.target.value.trim().toLowerCase();
    const rows = countryScoped(state.filters).filter(row => `${row.id} ${row.country} ${row.deployment} ${row.community} ${row.family}`.toLowerCase().includes(term));
    document.querySelector("#filterRows").innerHTML = filterRows(rows);
    translateDom(document.querySelector("#filterRows"));
  });
  document.querySelector("#lifecycleSearch")?.addEventListener("input", event => {
    lifecycleSearch = event.target.value;
    const workspace = document.querySelector("#lifecycleWorkspace");
    if (workspace) {
      workspace.innerHTML = lifecycleWorkspace();
      translateDom(workspace);
    }
  });
  document.querySelector("#lifecycleSort")?.addEventListener("change", event => {
    lifecycleSort = event.target.value;
    const workspace = document.querySelector("#lifecycleWorkspace");
    if (workspace) {
      workspace.innerHTML = lifecycleWorkspace();
      translateDom(workspace);
    }
  });
  syncLanguageUi();
  if (currentView === "map") requestAnimationFrame(mountRegistryMap);
}

function applyBootstrap(body) {
  state.session = body.session;
  state.tools = body.tools || [];
  for (const partner of body.partners || []) {
    portalBranding[partner.slug] = { ...partner, logoAlt: `${partner.name} logo` };
  }
  state.filters = body.filters || [];
  state.issues = body.issues || [];
  state.impact = body.impact || {};
  state.meta = body.meta || null;
  setScopeOptions();
  setProfile();
}

function readHubSnapshot() {
  if (isPortalHost) return null;
  try {
    const snapshot = JSON.parse(localStorage.getItem(HUB_SNAPSHOT_KEY) || "null");
    if (!snapshot?.savedAt || Date.now() - snapshot.savedAt > HUB_SNAPSHOT_MAX_AGE) {
      localStorage.removeItem(HUB_SNAPSHOT_KEY);
      return null;
    }
    return snapshot.body?.session && Array.isArray(snapshot.body.tools) ? snapshot.body : null;
  } catch {
    localStorage.removeItem(HUB_SNAPSHOT_KEY);
    return null;
  }
}

function writeHubSnapshot(body) {
  if (isPortalHost) return;
  try {
    localStorage.setItem(HUB_SNAPSHOT_KEY, JSON.stringify({
      savedAt: Date.now(),
      body: { session: body.session, tools: body.tools || [], partners: [], filters: [], issues: [], impact: {}, meta: body.meta || null }
    }));
  } catch {}
}

async function loadPortal({ background = false } = {}) {
  const hasSnapshot = !isPortalHost && Boolean(state.session) && state.tools.length > 0;
  if (!background) {
    state.loading = true;
    state.error = null;
    render();
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/bootstrap", {
      headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" },
      cache: "no-store",
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || "Portal unavailable"), { status: response.status });
    applyBootstrap(body);
    writeHubSnapshot(body);
    state.error = null;
  } catch (error) {
    const accessDenied = error.status === 401 || error.status === 403;
    if (!hasSnapshot || accessDenied) {
      if (accessDenied && !isPortalHost) localStorage.removeItem(HUB_SNAPSHOT_KEY);
      if (accessDenied) {
        state.session = null;
        state.tools = [];
      }
      state.error = {
        status: error.status || 503,
        message: error.name === "AbortError" ? "The registry request timed out" : error.message
      };
    }
  } finally {
    clearTimeout(timeout);
    state.loading = false;
    updateConnectionState(false);
    render();
  }
}

document.addEventListener("click", event => {
  if (event.target.closest("#languageMenuButton")) {
    const open = languageMenu.hidden;
    languageMenu.hidden = !open;
    languageMenuButton.setAttribute("aria-expanded", String(open));
    setMenuOpen(false);
    return;
  }
  const languageTarget = event.target.closest("[data-language]");
  if (languageTarget) {
    languageMenu.hidden = true;
    languageMenuButton.setAttribute("aria-expanded", "false");
    applyLanguage(languageTarget.dataset.language);
    return;
  }
  if (!event.target.closest(".language-picker")) {
    languageMenu.hidden = true;
    languageMenuButton.setAttribute("aria-expanded", "false");
  }
  if (event.target.closest("#menuButton")) {
    const open = menuPanel.hidden;
    setMenuOpen(open);
    return;
  }
  if (event.target.closest("#closeMenu") || event.target === drawerScrim) {
    setMenuOpen(false);
    menuButton.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest("#drawerLanguageButton")) { toggleDrawerPanel("drawerLanguageButton", "drawerLanguagePanel"); return; }
const hubScroll = event.target.closest("[data-hub-scroll]");
  if (hubScroll) {
    currentView = "home";
    history.replaceState(null, "", "#home");
    render();
    setMenuOpen(false);
    requestAnimationFrame(() => document.querySelector(`#${hubScroll.dataset.hubScroll}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  const countryTarget = event.target.closest("[data-country]");
  if (countryTarget) {
    currentCountry = countryTarget.dataset.country;
    render();
    return;
  }
  const followupModeTarget = event.target.closest("[data-followup-mode]");
  if (followupModeTarget) {
    followupMode = followupModeTarget.dataset.followupMode;
    render();
    return;
  }
  const filterTarget = event.target.closest("[data-filter-id]");
  if (filterTarget) {
    selectedFilterId = filterTarget.dataset.filterId;
    currentView = "filter-detail";
    history.replaceState(null, "", `#filter/${encodeURIComponent(selectedFilterId)}`);
    render();
    scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const target = event.target.closest("[data-view]");
  if (!target) return;
  setMenuOpen(false);
  if (target.dataset.followupTarget) followupMode = target.dataset.followupTarget;
  currentView = target.dataset.view;
  if (currentView !== "filter-detail") selectedFilterId = null;
  history.replaceState(null, "", `#${currentView}`);
  render();
  scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelector("#instructionsButton")?.addEventListener("click", () => {
  const guideList = document.querySelector("#menuGuideList");
  if (guideList) guideList.hidden = !guideList.hidden;
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !menuPanel.hidden) {
    setMenuOpen(false);
    menuButton.focus({ preventScroll: true });
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("tr[data-filter-id]")) {
    event.preventDefault();
    event.target.querySelector(".record-link")?.click();
  }
});

scope?.addEventListener("change", event => {
  if (!permittedPartnerIds().includes(event.target.value)) return;
  currentScope = event.target.value;
  currentCountry = "all";
  render();
});

themeToggle.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));

function updateConnectionState(rerender = true) {
  const label = document.querySelector(".rail-foot span:last-child");
  const dot = document.querySelector(".status-dot");
  if (label) label.textContent = translateText(navigator.onLine ? (state.error ? "Connection needed" : "Live · read-only") : "Offline app shell", currentLanguage);
  if (dot) dot.classList.toggle("connected", navigator.onLine && !state.error);
  if (rerender) render();
}

addEventListener("online", () => { updateConnectionState(); loadPortal(); });
addEventListener("offline", updateConnectionState);

if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

applyTheme(currentTheme(), false);
syncLanguageUi();
const hubSnapshot = readHubSnapshot();
if (hubSnapshot) {
  applyBootstrap(hubSnapshot);
  state.loading = false;
  state.error = null;
  render();
}
loadPortal({ background: Boolean(hubSnapshot) });
