# Squadron Terminal — landing page

The marketing/download site for [Squadron Terminal](../README.md), a separate Vite + React +
TypeScript + Tailwind CSS + Framer Motion project living in this subdirectory. It does not depend on
or affect the Tauri app in the rest of this repo.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the built output locally
```

## Deploying

- **GitHub Pages** (default): `vite.config.ts` sets `base: '/squadron-terminal/'` for this repo's
  Pages subpath. Deployed via `.github/workflows/deploy-pages.yml` on push to `main`.
- **Vercel**: set the project's **Root Directory** to `website`. `vite.config.ts` detects Vercel's
  `VERCEL` build-time env var and switches `base` to `/` automatically (Vercel serves from the domain
  root, not a subpath).
