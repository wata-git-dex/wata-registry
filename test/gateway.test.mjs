import test from "node:test";
import assert from "node:assert/strict";
import gateway from "../gateway.js";

const assets = {
  fetch(request) {
    return new Response(`<h1>${new URL(request.url).pathname}</h1>`, { headers: { "content-type": "text/html" } });
  }
};

test("static Registry responses receive security and privacy headers", async () => {
  const response = await gateway.fetch(new Request("https://registry.cleanwata.org/"), { ASSETS: assets });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(response.headers.get("cache-control"), "no-cache");
});

test("the Registry API fails closed when its private service binding is missing", async () => {
  const response = await gateway.fetch(new Request("https://registry.cleanwata.org/api/bootstrap"), { ASSETS: assets });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).error, "The registry service is temporarily unavailable");
});

test("the Registry API rejects write methods", async () => {
  const response = await gateway.fetch(new Request("https://registry.cleanwata.org/api/bootstrap", { method: "POST" }), { ASSETS: assets });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});

test("the Registry gateway uses the service binding and overwrites product scope", async () => {
  let forwarded;
  const response = await gateway.fetch(new Request("https://registry.cleanwata.org/api/bootstrap", { headers: { "x-wata-product": "hub" } }), {
    ASSETS: assets,
    PORTAL: { fetch(request) { forwarded = request; return Response.json({ ok: true }); } }
  });
  assert.equal(response.status, 200);
  assert.equal(forwarded.headers.get("x-wata-product"), "registry");
  assert.ok(forwarded.headers.get("x-request-id"));
});
