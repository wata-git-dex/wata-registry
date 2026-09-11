import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, app] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
  readFile(new URL("app.js", root), "utf8")
]);

test("Registry navigation keeps the shared header and drawer anatomy", () => {
  assert.match(html, /id="languageMenuButton"[\s\S]*?<svg class="utility-icon"/);
  assert.match(html, /id="menuButton"[\s\S]*?<svg class="utility-icon"/);
  assert.match(html, /id="closeMenu"[\s\S]*?<svg class="utility-icon"/);
  assert.match(html, /🇺🇸[\s\S]*?English[\s\S]*?🇪🇸[\s\S]*?Español/);
  assert.match(html, /W\.A\.T\.A\. profile[\s\S]*?Shared profile setup pending/);
  assert.doesNotMatch(html, /community\.cleanwata\.org\/#profile/);
});

test("Registry drawer behavior preserves state and accessibility", () => {
  assert.match(app, /drawerLanguagePanel\.hidden = true/);
  assert.match(app, /setAttribute\("aria-current", "page"\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => menuButton\.focus/);
  assert.match(css, /\.menu-action:focus-visible/);
  assert.match(css, /\[data-theme="dark"\] \.menu-action\.active/);
});

test("a successful Registry bootstrap cannot strand an authorized user on Home", () => {
  assert.match(app, /isPortalHost && authenticatedSession[\s\S]*?portalEnabled: true/);
});

test("Registry corrections keep truthful map and schedule populations", () => {
  assert.match(app, /row\.followupEnrolled === true/);
  assert.match(app, /Upcoming · nearest first/);
  assert.match(app, /Only actual enrolled schedule records are listed/);
  assert.match(app, /Approximate — community location/);
  assert.match(app, /recorded[\s\S]*approximate[\s\S]*unlocated/);
  assert.match(css, /\.registry-table \{[^}]*table-layout: fixed/);
  assert.match(css, /\.command-main-grid \{[^}]*repeat\(2/);
});

test("recent activity consolidates same-day lifecycle transitions", () => {
  assert.match(app, /const byDate = new Map\(\)/);
  assert.match(app, /Drop-off → Distributed/);
  assert.match(app, /Drop-off · In inventory/);
  assert.match(css, /\.activity-dot\.transition/);
});

test("mobile Registry chrome respects every device safe area", () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /\.topbar[\s\S]*?safe-area-inset-top[\s\S]*?safe-area-inset-right[\s\S]*?safe-area-inset-left/);
  assert.match(css, /\.menu-panel[^}]*height: 100dvh[^}]*safe-area-inset-top[^}]*safe-area-inset-right[^}]*safe-area-inset-bottom[^}]*safe-area-inset-left/);
  assert.match(css, /\.mobile-nav[^}]*safe-area-inset-left[^}]*safe-area-inset-right[^}]*safe-area-inset-bottom/);
});
