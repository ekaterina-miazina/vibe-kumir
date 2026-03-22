# VibeKumir

Phase 1 foundation for a browser-only robot programming environment built with Vue 3 + TypeScript.

## Included in this milestone

- Vue 3 + Vite app shell with a three-panel layout.
- Pure TypeScript robot world model with walls, paint, and robot position.
- Minimal parser/interpreter for a Kumir-like subset.
- Vitest unit coverage for collision and paint flows.
- Playwright configuration with console/pageerror guards.
- GitHub Pages deployment workflow for static hosting from this repository.

## Run locally

```bash
npm install
npm run dev
npm run test
npm run test:e2e
npm run build
```

## Publish to GitHub Pages

1. Push the branch with `.github/workflows/deploy-pages.yml` to GitHub.
2. In the repository settings, open **Pages** and set **Source** to **GitHub Actions**.
3. After the workflow finishes, GitHub Pages will publish the generated `dist/` output automatically.

The Vite config uses a relative asset base so the built app works from a project Pages URL such as `https://<user>.github.io/<repo>/`.
