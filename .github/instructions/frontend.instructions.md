---
applyTo: "src/**"
description: "Frontend guidance for the LAZEO-StoreKSA React + Vite app"
---

- Keep changes aligned with [src/App.jsx](src/App.jsx), which owns providers and routing.
- Reuse existing patterns in [src/components](src/components), [src/context](src/context), and [src/pages](src/pages) before adding new abstractions.
- For GitHub Pages, keep the repo slug base path in sync across [vite.config.js](vite.config.js) and [package.json](package.json).
- Avoid hardcoding backend URLs in new frontend code; follow the existing config-driven approach where possible.
- If you touch shared app bootstrap behavior, confirm the impact in [src/main.jsx](src/main.jsx) and the app shell in [src/App.jsx](src/App.jsx).
