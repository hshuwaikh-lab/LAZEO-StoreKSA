---
applyTo: "package.json"
description: "Deployment guidance for GitHub Pages builds and publishing"
---

- Keep the GitHub Pages base path in [vite.config.js](vite.config.js) aligned with the repo slug and the `homepage` field in [package.json](package.json).
- Treat `predeploy` and `deploy` in [package.json](package.json) as the source of truth for publishing the built site.
- Use [deploy-gh-pages.cmd](deploy-gh-pages.cmd) and the GitHub Actions workflow in [.github/workflows](.github/workflows) as the deployment path; do not reintroduce ad hoc publishing steps.
- Rebuild with `npm run build` before deployment changes and verify the generated output matches the Pages path.
- Avoid changing Pages-related files unless the publish target, branch, or base URL is intentionally changing.
