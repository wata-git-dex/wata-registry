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
