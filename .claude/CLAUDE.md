# StillNoob - Claude Instructions

## What is this?

WoW coaching platform — analyzes WarcraftLogs data and gives personalized improvement advice.
**Domain:** stillnoob.com | **Launch:** March 17, 2026 (WoW Midnight Season 1)

## Stack

- **Monorepo:** npm workspaces + turbo
- **API:** Express.js + Drizzle ORM + Turso (libsql) in `packages/api/src/`
- **Frontend:** React + Vite + Tailwind in `packages/web/` (landing page in `public/`)
- **Shared:** Constants/types in `packages/shared/`
- **Deploy:** Cloudflare Workers (landing + API proxy) → Render (API) → Turso (DB)
- **ES Modules everywhere** — no `require()`

## Key Files

- `packages/api/src/app.js` — Express setup, middleware, routes
- `packages/api/src/db/schema.js` — Drizzle schema (all tables)
- `packages/api/src/services/analysis.js` — Score engine, recommendations
- `packages/api/src/services/wcl.js` — WarcraftLogs GraphQL client
- `packages/api/src/middleware/auth.js` — JWT + role middleware
- `packages/api/src/jobs/scanReports.js` — Background WCL scanner
- `PROJECT.md` — Full project rules, schema, API routes, design rules
- `ANALYSIS.md` — Security audit, architecture review, launch strategy
- `FOUNDATIONS.md` — Product decisions (local only, not in git)

## Code Rules

- API routes: `/api/v1/` prefix, JSON responses: `{ error: "message" }`
- Dark void/purple palette — NEVER hardcode colors, use CSS variables
- Fonts: Cinzel (headings), Rajdhani (body), Orbitron (stats)
- `node_modules/`, `.env`, `*.db` NEVER in repo
- Run `npm run lint` + `npm run test` before committing

## Development

```bash
# API (from packages/api/)
node --watch src/index.js       # Dev server (port 3001)
npx drizzle-kit push            # Apply schema to local SQLite

# Root
npm run lint                    # ESLint
npm run format                  # Prettier
npm run test                    # Vitest + Supertest
```

## Workflow

- Plan mode for non-trivial tasks. Explore → Plan → Implement → Verify → Commit
- Read before writing — understand existing code first
- Use `/clear` between unrelated tasks — clean sessions beat polluted ones
- Check ANALYSIS.md for known security issues and architecture bottlenecks before modifying affected code
- This is NOT the DKP project — different repo, different DB, different codebase
