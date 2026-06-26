---
applyTo: "server/**"
description: "Backend guidance for the LAZEO-StoreKSA Express + Prisma API"
---

- Keep backend changes aligned with [server/package.json](server/package.json) and the Prisma schema in [server/prisma/schema.prisma](server/prisma/schema.prisma).
- Treat hardcoded secrets, default admin credentials, and permissive CORS settings in [server/index.js](server/index.js) as security-sensitive.
- Prefer Prisma schema updates and data-access changes that preserve the local SQLite workflow.
- When adding or changing endpoints, review their effect on the React client flows that depend on the local API.
- Use the server folder commands for backend-specific validation instead of root frontend commands.
