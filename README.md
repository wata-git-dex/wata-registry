# W.A.T.A. Registry

The secure W.A.T.A. Filter Registry and Partner Portal.

- Production: `https://registry.cleanwata.org`
- Cloudflare project: `wata-registry`
- Authorization source: Airtable `Surveyors`

## Build

```sh
npm run check
npm run build
```

The static site and Pages advanced-mode Worker are written to `dist/`. Cloudflare Pages should use `npm run build` and `dist` as its output directory.

## Deployment boundary

This repository owns only the Registry frontend, Registry PWA, Registry assets, bundled partner guide, and Registry gateway. During the controlled migration, `/api/` uses a service binding named `PORTAL` to the proven read-only `wata-partner-portals` Worker. Tech Hub frontend and PWA files are not deployed from this repository.

Production domain routing must not move until a preview deployment passes authentication, partner-scope, data-projection, desktop, mobile, and offline-shell checks.
