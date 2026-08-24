const APP_SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; frame-src https://map.cleanwata.org; worker-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive"
};

function json(body, status, requestId) {
  return secureResponse(Response.json(body, { status }), { api: true, requestId });
}

function secureResponse(response, { api = false, pathname = "", requestId = "" } = {}) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(APP_SECURITY_HEADERS)) headers.set(name, value);
  headers.set("content-security-policy", api ? "default-src 'none'; frame-ancestors 'none'" : APP_SECURITY_HEADERS["content-security-policy"]);
  if (requestId) headers.set("x-request-id", requestId);
  if (api) {
    headers.set("cache-control", "private, no-store");
  } else if (pathname.startsWith("/assets/")) {
    headers.set("cache-control", "public, max-age=86400");
  } else {
    headers.set("cache-control", "no-cache");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();

    try {
      if (url.pathname.startsWith("/api/")) {
        if (request.method !== "GET") {
          const response = json({ error: "Method not allowed", request_id: requestId }, 405, requestId);
          response.headers.set("allow", "GET");
          return response;
        }
        if (!env.PORTAL) {
          console.error(JSON.stringify({ level: "error", event: "registry_binding_missing", request_id: requestId }));
          return json({ error: "The registry service is temporarily unavailable", request_id: requestId }, 503, requestId);
        }
        const backendRequest = new Request(request);
        backendRequest.headers.set("x-wata-product", "registry");
        backendRequest.headers.set("x-request-id", requestId);
        const response = await env.PORTAL.fetch(backendRequest);
        return secureResponse(response, { api: true, requestId });
      }

      const response = await env.ASSETS.fetch(request);
      return secureResponse(response, { pathname: url.pathname });
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "registry_gateway_error", request_id: requestId, message: error instanceof Error ? error.message : "Unknown error" }));
      return url.pathname.startsWith("/api/")
        ? json({ error: "The registry service is temporarily unavailable", request_id: requestId }, 503, requestId)
        : secureResponse(new Response("The W.A.T.A. Filter Registry is temporarily unavailable.", { status: 503 }), { pathname: url.pathname, requestId });
    }
  }
};

export { APP_SECURITY_HEADERS, secureResponse };
