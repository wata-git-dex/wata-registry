# W.A.T.A. Registry

The secure W.A.T.A. Filter Registry and Partner Portal.

- Production: `https://registry.cleanwata.org`
- Preview: `https://wata-registry.pages.dev`
- Cloudflare project: `wata-registry`
- Authorization source: Airtable `Surveyors`

## Build

```sh
npm run check
npm run build
```

The static site and Pages advanced-mode Worker are written to `dist/`. Cloudflare Pages is connected directly to this GitHub repository and deploys `main` automatically with `npm run build` and `dist` as its output directory.

## Deployment boundary

This repository owns only the Registry frontend, Registry PWA, Registry assets, bundled partner guide, and Registry gateway. `/api/` uses a service binding named `PORTAL` to the proven authorization/data Worker, `wata-partner-portals`. Tech Hub frontend and PWA files are not deployed from this repository.

Cloudflare Access protects the production hostname with the `WATA Portal — Airtable-gated email login` policy. Its project destination is `wata-registry.pages.dev`; the legacy shared Pages destination has been removed.

The legacy `wata-partner-portals-gateway` Pages project is retained temporarily for rollback only. It no longer owns the Registry production domain.
