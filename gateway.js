const LEGACY_BACKEND = "https://wata-partner-portals.cleanwataorg.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = new URL(url.pathname + url.search, LEGACY_BACKEND);
      const backendRequest = new Request(backendUrl, request);
      backendRequest.headers.set("x-wata-product", "registry");
      return env.PORTAL ? env.PORTAL.fetch(backendRequest) : fetch(backendRequest);
    }
    return env.ASSETS.fetch(request);
  }
};
