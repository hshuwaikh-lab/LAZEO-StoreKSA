# AGENTS.md

## Project Overview
- React + Vite frontend with a Node/Express backend.
- Frontend entry: [src/main.jsx](src/main.jsx), app shell and routing in [src/App.jsx](src/App.jsx).
- Shared UI lives in [src/components](src/components), global state in [src/context](src/context), and feature screens in [src/pages](src/pages).
- Backend API and auth/session logic live in [server/index.js](server/index.js).
- Data model is Prisma + SQLite in [server/prisma/schema.prisma](server/prisma/schema.prisma).

## Commands
- Install root dependencies: `npm install`
- Start the full local stack: `npm start`
- Frontend only: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`
- Backend only: `cd server && npm install && npm start`
- Full local Windows startup: [start.bat](start.bat)
- GitHub Pages publish: `npm run deploy`

## Conventions
- Keep changes aligned with the existing route/provider split in [src/App.jsx](src/App.jsx).
- Prefer linking to existing docs instead of duplicating them; see [README.md](README.md) and [SECURITY.md](SECURITY.md).
- Use the repo-specific GitHub Pages setup already wired in [vite.config.js](vite.config.js), [package.json](package.json), and [deploy-gh-pages.cmd](deploy-gh-pages.cmd).

## Gotchas
- Several frontend flows still point at `http://localhost:5000`; update those carefully if you change the backend base URL.
- The backend contains hardcoded security fallbacks and permissive CORS in [server/index.js](server/index.js); treat those values as sensitive.
- `npm run deploy` publishes the built `dist` folder to `gh-pages`; avoid casual runs because it can overwrite the deployed branch.
- [public/auth.js](public/auth.js) looks like a legacy alternate auth path and is not referenced by the main React app.
