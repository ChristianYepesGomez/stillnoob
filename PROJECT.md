# StillNoob - Project Rules & Context

## What is StillNoob?

WoW coaching platform that analyzes player data (logs, gear, gameplay) and provides personalized coaching advice. Think "personal coach reading your logs and telling you exactly what to do."

- **Domain:** stillnoob.com
- **Repo:** github.com/ChristianYepesGomez/stillnoob
- **Launch target:** March 17, 2026 (WoW Midnight Season 1)
- **Creator:** Christian Yepes Gomez (Valencia, Spain)

---

## Stack

- **Frontend:** HTML/CSS (landing page), React (app futura)
- **Backend:** Node.js with ES Modules, Express.js (in packages/api/)
- **Database:** Turso (libsql remote) + Drizzle ORM — local dev uses `file:./data/stillnoob.db`
- **Deploy (landing):** Cloudflare Workers (free) — `stillnoob` worker serves `./public` static files
- **Deploy (API):** Render (free tier, Frankfurt) — auto-deploy on push to main
- **Deploy (API proxy):** Cloudflare Worker `stillnoob-api-proxy` — routes `api.stillnoob.com/*` → Render
- **Domain registrar:** Namecheap
- **DNS/CDN:** Cloudflare (free)
- **Repo hosting:** GitHub (public)
- **Monorepo:** npm workspaces + turbo

## Infrastructure

### URLs

| Service       | URL                                  | Host                               |
| ------------- | ------------------------------------ | ---------------------------------- |
| Landing       | `https://stillnoob.com`              | Cloudflare Workers (`stillnoob`)   |
| Landing (www) | `https://www.stillnoob.com`          | Cloudflare (CNAME → stillnoob.com) |
| API (public)  | `https://api.stillnoob.com`          | Cloudflare Worker proxy → Render   |
| API (direct)  | `https://stillnoob-api.onrender.com` | Render (free tier, Frankfurt)      |
| Database      | Turso `stillnoob-db`                 | Turso (Frankfurt)                  |

### DNS Records (Cloudflare)

| Type  | Name            | Content         | Proxy                   |
| ----- | --------------- | --------------- | ----------------------- |
| A     | `stillnoob.com` | `192.0.2.1`     | Proxied (Workers Route) |
| A     | `api`           | `192.0.2.1`     | Proxied (Workers Route) |
| CNAME | `www`           | `stillnoob.com` | Proxied                 |

### Workers Routes

| Route                 | Worker                                         |
| --------------------- | ---------------------------------------------- |
| `stillnoob.com/*`     | `stillnoob` (static landing page)              |
| `api.stillnoob.com/*` | `stillnoob-api-proxy` (reverse proxy → Render) |

### Render Config

- Blueprint: `render.yaml` in repo root
- Root dir: `packages/api`
- Build: `npm install`
- Start: `node src/index.js`
- Region: Frankfurt
- Auto-deploy: on push to `main`
- Custom domain: `api.stillnoob.com` (verified, but uses Worker proxy route instead)

### Turso Config

- Database: `stillnoob-db` (Frankfurt)
- Schema push: `npx drizzle-kit push --config=drizzle.config.prod.js` (from packages/api/)
- Local dev: `dialect: 'sqlite'` in `drizzle.config.js`
- Production: `dialect: 'turso'` in `drizzle.config.prod.js`

### Architecture Notes

- Render uses Cloudflare CDN internally → CNAME `api` → `onrender.com` causes Cloudflare Error 1000 (CF-to-CF conflict)
- Solution: Cloudflare Worker `stillnoob-api-proxy` acts as reverse proxy, fetching from Render's origin URL
- This avoids the DNS conflict while keeping `api.stillnoob.com` as the public-facing URL
- `trust proxy` is set in Express for production (Render sends X-Forwarded-For headers)

---

## Design Rules

- Dark theme with void/purple palette matching WoW Midnight aesthetic
- NEVER hardcode colors — use CSS variables (defined in index.html :root)
- Color palette:
  - `--void-deep: #0a0612` (deepest background)
  - `--void-mid: #12091f` (card/section background)
  - `--void-surface: #1a0f2e` (elevated surfaces)
  - `--void-glow: #7b2ff2` (primary accent / glow)
  - `--void-bright: #9d5cff` (secondary accent)
  - `--void-accent: #c084fc` (tertiary / links)
  - `--sunwell-gold: #f6c843` (highlight/gold/CTA)
  - `--sunwell-amber: #ff9f1c` (warm accent)
  - `--fel-green: #00ff88` (success / online indicators)
  - `--blood-red: #ff3b5c` (danger / errors)
  - `--text-primary: #e8e0f0` (main text)
  - `--text-secondary: #9a8bb5` (secondary text)
  - `--text-muted: #5c4f73` (muted/disabled text)
- Mobile-first responsive design
- Gamer aesthetic — avoid generic/corporate look
- Fonts: Cinzel (headings), Rajdhani (body), Orbitron (numbers/stats)

---

## Code Rules

- `node_modules/` NEVER in the repo — always in .gitignore
- `.env` NEVER in the repo — use `.env.example` with placeholder values
- `*.db` NEVER in the repo — database files are local-only
- Static/public files go in `/public`
- Backend code goes in `/packages/api/src/`
- Shared constants/types in `/packages/shared/` (if exists)
- ES Modules everywhere (`"type": "module"` in package.json)
- API routes prefixed with `/api/v1/`

---

## Project Structure

```
stillnoob/
├── public/
│   └── index.html              # Landing page (static, served by Cloudflare)
├── packages/
│   ├── api/
│   │   ├── .env                # API keys (NOT in repo)
│   │   ├── data/               # SQLite database (NOT in repo)
│   │   ├── drizzle.config.js   # Drizzle ORM config
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js        # Server entry point
│   │       ├── app.js          # Express app setup, middleware, route mounting
│   │       ├── db/
│   │       │   ├── client.js   # libsql database connection
│   │       │   └── schema.js   # Drizzle schema (all tables)
│   │       ├── middleware/
│   │       │   ├── auth.js        # JWT generation/verification, role middleware
│   │       │   └── rateLimit.js
│   │       ├── routes/
│   │       │   ├── auth.js         # /api/v1/auth — login, register, OAuth
│   │       │   ├── characters.js   # /api/v1/characters — character CRUD
│   │       │   ├── reports.js      # /api/v1/reports — WCL report management
│   │       │   ├── analysis.js     # /api/v1/analysis — coaching analysis
│   │       │   ├── guilds.js       # /api/v1/guilds — guild management
│   │       │   └── public.js       # /api/v1/public — unauthenticated lookups
│   │       ├── services/
│   │       │   ├── wcl.js          # WarcraftLogs API (GraphQL, OAuth client credentials)
│   │       │   ├── blizzard.js     # Blizzard API (character, gear, armory)
│   │       │   ├── analysis.js     # Coaching engine (score calculation, recommendations)
│   │       │   └── rateLimiter.js  # Rate limiting logic
│   │       └── jobs/
│   │           ├── scanReports.js  # Background job: scan WCL for new reports
│   │           └── scheduler.js    # Cron scheduler for background jobs
│   ├── shared/                 # Shared constants/types between packages
│   └── web/                    # Future React app (not yet built)
├── wrangler.jsonc              # Cloudflare Workers config
├── .gitignore                  # node_modules, .env, *.db, .wrangler/
├── workers/
│   └── api-proxy/
│       ├── worker.js           # Cloudflare Worker: reverse proxy to Render
│       └── wrangler.toml       # Worker config (deploy via wrangler or dashboard)
├── render.yaml                 # Render Blueprint (auto-deploy config)
├── PROJECT.md                  # THIS FILE - project rules & context
├── package.json                # Root workspace config (turbo)
└── turbo.json                  # Turbo monorepo config (if exists)
```

---

## Database Schema (Drizzle ORM)

### Tables

| Table               | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `users`             | User accounts (email, password, display name, tier: free/premium/admin) |
| `auth_providers`    | OAuth providers (google, discord, blizzard, warcraftlogs)               |
| `refresh_tokens`    | JWT refresh tokens                                                      |
| `characters`        | WoW characters linked to users (name, realm, region, class, spec, role) |
| `guilds`            | Guild information                                                       |
| `guild_members`     | Guild membership                                                        |
| `reports`           | WarcraftLogs report metadata                                            |
| `fights`            | Individual fights within reports                                        |
| `fight_performance` | Per-player per-fight performance data                                   |
| `bosses`            | Boss reference data                                                     |

### Key relationships

- `users` 1→N `characters` (user owns characters)
- `users` 1→N `auth_providers` (OAuth connections)
- `users` 1→N `guild_members` → `guilds` (user belongs to guilds)
- `guilds` 1→N `guild_members` (guild has members with roles: leader/officer/member)
- `reports` 1→N `fights` (report contains fights)
- `reports` N→1 `guilds` (report optionally belongs to a guild)
- `fights` 1→N `fight_performance` (fight has player performances)

### Report Visibility

Reports have a `visibility` field: `public` | `private` | `guild`

- **public** — visible to everyone, included in SEO/public routes
- **private** — only visible to the user who imported it
- **guild** — visible to all members of the associated guild
- Public route (`/api/v1/public/*`) only shows data from `visibility='public'` reports
- Private/guild data requires authentication and membership checks

---

## API Architecture

### External APIs

| API             | Auth Method                                                  | Purpose                                             |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| WarcraftLogs v2 | Client credentials (public data) + User OAuth (private logs) | Combat logs, parse data, rankings                   |
| Blizzard API    | Client credentials (public) + User OAuth (character linking) | Character profiles, gear, talents                   |
| Raider.io       | Public (no auth)                                             | M+ score, dungeon run history (NOT YET IMPLEMENTED) |

### WCL Two-Tier Auth

- **Client credentials** (`WCL_CLIENT_ID` + `WCL_CLIENT_SECRET`): Access public reports. Used by default for all imports and background scanning.
- **User OAuth** (user links WCL account via `/auth/wcl/link`): Access private reports. Token stored in `auth_providers` with `provider='warcraftlogs'`. Import endpoint tries user token first, falls back to client credentials.
- **GraphQL endpoints**: Client token → `https://www.warcraftlogs.com/api/v2/client`, User token → `https://www.warcraftlogs.com/api/v2/user`

### Environment Variables Required (.env)

```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3001
TURSO_DATABASE_URL=file:./data/stillnoob.db
TURSO_AUTH_TOKEN=
JWT_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>
WCL_CLIENT_ID=<from warcraftlogs.com/api/clients>
WCL_CLIENT_SECRET=<from warcraftlogs.com/api/clients>
BLIZZARD_CLIENT_ID=<from develop.battle.net>
BLIZZARD_CLIENT_SECRET=<from develop.battle.net>
BLIZZARD_REGION=eu
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

### API Routes

| Route                  | Auth  | Description                               |
| ---------------------- | ----- | ----------------------------------------- |
| `GET /api/health`      | No    | Health check                              |
| `/api/v1/auth/*`       | Mixed | Login, register, OAuth callbacks          |
| `/api/v1/characters/*` | Yes   | Character CRUD, link to user              |
| `/api/v1/reports/*`    | Yes   | WCL report import & management            |
| `/api/v1/analysis/*`   | Yes   | Coaching analysis & scores                |
| `/api/v1/public/*`     | No    | Public character lookup (no login needed) |
| `/api/v1/guilds/*`     | Yes   | Guild management                          |

---

## Authentication System

- **Access tokens**: JWT, 15-minute expiry, sent as `Authorization: Bearer <token>`
- **Refresh tokens**: JWT, 30-day expiry, stored in httpOnly cookie at path `/api/v1/auth`
- **Token rotation**: On refresh, old token is deleted and new pair issued (prevents replay)
- **Password hashing**: bcrypt with 12 salt rounds
- **OAuth providers**: Google, Discord, Blizzard (character linking), WarcraftLogs (private logs)
- **User tiers**: `free` | `premium` | `admin`

## Background Jobs

- **Scheduler**: `node-cron` running every 30 minutes (initialized on server start)
- **Report scanner**: Iterates all registered characters, queries WCL for new reports, auto-imports
- **Rate limiter**: Token bucket (280 tokens/hour, WCL limit is 300, 20 kept as buffer)
- **Graceful degradation**: If WCL credentials not configured, scheduler logs and skips

## Development Commands

```bash
# From packages/api/
npx drizzle-kit push          # Apply schema changes to local SQLite
node src/index.js             # Start server (port 3001)
node --watch src/index.js     # Start with auto-reload
npx kill-port 3001            # Kill stuck server process

# From root
npm install                   # Install all workspace deps
```

---

## StillNoob Score System

- **Performance:** 35% (DPS/HPS parse percentile from WCL)
- **Survival:** 25% (avoidable damage, deaths per fight)
- **Preparation:** 20% (gear, gems, enchants, consumables)
- **Utility:** 10% (interrupts, dispels, utility usage)
- **Consistency:** 10% (variance across fights)

### Tiers (defined in `packages/shared/src/constants.js`)

| Tier      | Score Range | Color   | Description        |
| --------- | ----------- | ------- | ------------------ |
| Noob      | 0-20        | #888888 | Just starting out  |
| Casual    | 21-40       | #00ff88 | Playing for fun    |
| Decent    | 41-60       | #0096ff | Getting there      |
| Skilled   | 61-75       | #9d5cff | Above average      |
| Pro       | 76-85       | #ff9f1c | Competitive player |
| Elite     | 86-95       | #ff3b5c | Top tier           |
| Legendary | 96-100      | #f6c843 | Best of the best   |

---

## Data Sources

- **WarcraftLogs API** — Combat logs, parses, rankings, fight-by-fight data (GraphQL)
- **Raider.io API** — M+ score, dungeon runs, best runs
- **Blizzard Armory API** — Character gear, talents, spec, achievement points
- **SimC / Analyzer / Feast outputs** — User-provided (future)

---

## User Flow (Screens)

1. **Landing Page** → Character name + realm + region input (current: public/index.html)
2. **Loading** → Animated progress with status messages ("Analyzing your logs...")
3. **Dashboard** → Score badge + Stats + Gear + Coaching messages
4. **Share** → Share score on social/Discord (viral marketing loop)
5. **Detail/Premium** → Fight-by-fight analysis (future premium feature)

---

## Current Status (Feb 9, 2026)

### Backend — DONE

- Auth (register/login/refresh/logout/me)
- Characters CRUD (create/list/primary/ownership)
- WCL import (public + private reports via user OAuth)
- Analysis engine (summary, boss breakdown, weekly trends, recent fights, recommendations)
- StillNoob Score (proprietary 0-100 metric with 7 tiers)
- Public character route (SEO-indexable, no auth)
- Guild system (create/join/leave/roles/settings/kick)
- Report visibility (public/private/guild)
- WCL User OAuth (private log access)
- Blizzard OAuth (character import)
- Background jobs (auto-scan WCL every 30min)
- Rate limiter (token bucket for WCL API)

### Frontend — DONE (Feb 9, 2026)

- React 18 + Vite 6 + Tailwind 3 + Recharts + i18next (EN/ES)
- Void palette aligned with landing page design
- Pages: Landing, Login, Register, Dashboard, Analysis (5 tabs), Guild, CharacterPublic
- Components: ScoreBadge (SVG ring + breakdown), StatCard, ConsumableBar, OverviewSection, BossesSection, TrendsSection, RecommendationsSection
- Auth: JWT in memory + httpOnly refresh cookie + auto-token-refresh interceptor
- API proxy: Vite proxies `/api` to port 3001
- OAuth linking UI (WCL + Blizzard) in Dashboard

### Infrastructure — DONE (Feb 9, 2026)

- Landing: Cloudflare Workers (`stillnoob`) → `stillnoob.com`
- API: Render free tier (Frankfurt) → `api.stillnoob.com` (via Worker proxy)
- Database: Turso `stillnoob-db` (Frankfurt)
- Auto-deploy on push to `main`

### Not Yet Built

- Raider.io integration
- Google/Discord OAuth
- Email verification
- Premium tier features & payment
- Frontend production deployment (React app on Cloudflare Pages or similar)
- Playwright E2E tests
- AI-generated coaching text: Use LLM to write natural-language recommendations from analysis data (ref: prompts.chat as prompt library)

---

## Business Model

| Tier         | Price | Includes                                                                    |
| ------------ | ----- | --------------------------------------------------------------------------- |
| **Free**     | $0    | Score + 2-week history + basic tips + shareable badge (viral growth engine) |
| **Premium**  | 4€/mo | Full history + boss breakdown + weekly trends + all recommendations         |
| **Pro/Team** | 7€/mo | Guild dashboard + team comparison + priority background scanning            |

- Free for first 3 months post-launch. Introduce Premium at month 4 when users are hooked
- Free tier MUST include shareable score badge — this is the growth engine
- WCL Premium is 9€/mo → StillNoob Premium at 4€/mo is a clear value proposition

---

## Common Mistakes Log

- ❌ `node_modules` was committed to repo → Fixed with `.gitignore` + `git rm -r --cached` (Feb 9, 2026)
- ❌ `wrangler.jsonc` pointed to `"./"` instead of `"./public"` → Fixed (Feb 9, 2026)
- ❌ `.gitignore` was in UTF-16LE encoding, git didn't read it properly → Rewritten in UTF-8 (Feb 9, 2026)
- ❌ Cloudflare build failed due to 31.9MB turbo binary in node_modules → Fixed by removing node_modules from repo
- ❌ `.env` with API keys committed → Should use `.env.example` pattern
- ⚠️ File `@libsql/win32-x64-msvc/index.node` can get locked by running processes — close all terminals/servers before git operations
- ⚠️ `.git/index.lock` can get stuck if VS Code or multiple terminals access the repo simultaneously — kill stale git processes and `rm .git/index.lock`
- ⚠️ Drizzle dialect: Use `dialect: 'sqlite'` in `drizzle.config.js` for local `file:` databases. `dialect: 'turso'` only works with remote Turso URLs.
- ⚠️ `dotenv/config` does NOT work with `node -e` inline eval — use a temp `.js` file instead for testing
- ⚠️ `API_URL` must be set in `.env` for OAuth callback URLs (WCL, Blizzard) to work correctly
- ⚠️ Cloudflare-to-Cloudflare conflict (Error 1000): Render uses CF CDN, so CNAME `api` → `onrender.com` fails even with DNS-only. Solution: Use a Cloudflare Worker as reverse proxy instead of CNAME.
- ⚠️ Worker proxy must NOT add CORS headers — let Express handle CORS. Duplicate headers or `Allow-Origin: *` + `Allow-Credentials: true` will cause browser rejections.
- ⚠️ `express-rate-limit` requires `app.set('trust proxy', 1)` when behind a reverse proxy (Render, Cloudflare) — otherwise throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR

---

## Competitive Landscape

> Full analysis with pricing strategy, launch plan, security audit, and architecture review: **[ANALYSIS.md](ANALYSIS.md)**

| Product       | What it does                                                      | StillNoob's edge                                                            |
| ------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| WarcraftLogs  | Raw data, rankings, detailed logs. Multi-report analysis at 9€/mo | No coaching — just data dumps. StillNoob delivers better coaching cheaper   |
| Raider.io     | M+ rankings, dungeon scores                                       | No coaching, no raid analysis                                               |
| WoWAnalyzer   | Per-spec rotation analysis (open source)                          | Per-spec maintenance unsustainable. Limited coverage. No cross-fight trends |
| Archon        | Tier lists, meta builds                                           | Generic, not personalized                                                   |
| Wipefest      | Was great for wipe analysis                                       | **Dead.** Lesson: single-dev maintenance risk                               |
| **StillNoob** | **Automated personalized coaching from real data**                | **"Spotify Wrapped" for WoW + skill-adapted advice. Nobody else does this** |

---

## Relationship with DKP Backend

StillNoob was born from the "Deep Performance Analysis" feature of the DKP backend (github.com/ChristianYepesGomez — dkp-backend/dkp-frontend). Key context:

- The DKP project has existing code for WCL integration, performance analysis, and recommendations
- Files that inspired StillNoob: `services/performanceAnalysis.js`, `services/warcraftlogs.js`
- StillNoob is independent — it does NOT share code or database with DKP
- Eventually, DKP may link to StillNoob for deep analysis instead of doing it in-house
- DKP continues to handle guild management, auctions, calendar, buffs, and basic analytics

---

## Timeline (Updated)

| Week | Dates          | Goal                                                                             |
| ---- | -------------- | -------------------------------------------------------------------------------- |
| 1    | Feb 10-16      | Name ✅, domain ✅, user flow ✅, landing ✅, infra ✅ (Render+Turso+CF Workers) |
| 2    | Feb 17-23      | Project structure, input system, **setup Playwright + first tests**              |
| 3    | Feb 24 - Mar 2 | Analysis engine (APIs) + **tests for API calls & character input**               |
| 4    | Mar 3-9        | Coaching system, dashboard + **tests for dashboard & coaching**                  |
| 5    | Mar 10-16      | Polish UI, promotion — **everything already tested, no firefighting**            |
| 🎯   | **Mar 17**     | **LAUNCH with Midnight Season 1**                                                |

---

## AI Assistant Rules (for Claude / any LLM)

### Context Management

- Use `/clear` between unrelated tasks — a clean session with a good prompt always beats a long polluted one
- If you've corrected Claude 2+ times on the same issue in one session, `/clear` and rewrite the prompt incorporating what you learned
- Use subagents for codebase exploration — keeps main context clean for implementation
- Scope investigations: "investigate token refresh in src/middleware/auth.js" NOT "investigate the auth system"

### Session Patterns

- **Explore → Plan → Implement → Verify → Commit** for non-trivial tasks
- **Interview-Driven Spec**: For complex features, have Claude interview you about requirements → write spec to file → `/clear` → implement from spec in clean session
- **Writer/Reviewer**: Use one session to implement, another to review the implementation
- **Fresh sessions for fresh tasks**: Don't mix unrelated work in one session

### Code Quality Enforcement

- **ESLint** is configured — run `npm run lint` to check, fix warnings before committing
- **Prettier** is configured — run `npm run format` to auto-format, `npm run format:check` to verify
- **Vitest + Supertest** for API tests — run `npm run test` before committing
- **GitHub Actions CI** runs lint + format check + tests on every push/PR to main
- Don't ask Claude to format code — Prettier does that deterministically
- Don't ask Claude to catch unused variables — ESLint does that

### General Rules

- If something goes sideways, STOP and re-plan. Don't keep pushing broken approaches
- Write rules here that prevent the same mistake from happening twice
- Always check `.gitignore` before committing new file types
- Never expose API keys, tokens, or personal data in code or commits
- When making infrastructure changes, explain step by step
- Keep this `PROJECT.md` updated with every major decision or mistake
- Use ES Modules (`import/export`) everywhere — no `require()`
- Follow existing code patterns in the codebase before introducing new ones
- API responses should always be JSON with consistent error format: `{ error: "message" }`
- Rate limiting is already configured — respect it in new endpoints
- Multiple Claude terminals may work on this repo simultaneously — coordinate git operations carefully. Never force-push without asking
- The DKP backend project runs on `c:\Proyectos\dkp-backend` and `c:\Proyectos\dkp-frontend` — don't confuse repos
- For parallel multi-agent work, consider git worktrees to avoid file conflicts

---

## Code Quality Tooling

| Tool           | Command             | Purpose                                  |
| -------------- | ------------------- | ---------------------------------------- |
| ESLint         | `npm run lint`      | Code quality, unused vars, common errors |
| Prettier       | `npm run format`    | Deterministic code formatting            |
| Vitest         | `npm run test`      | API unit/integration tests               |
| Supertest      | (used in tests)     | HTTP assertion library for Express       |
| GitHub Actions | (automatic on push) | CI pipeline: lint + format + test        |

### Adding New Tests

- Test files go in `packages/api/src/__tests__/*.test.js`
- Use Supertest to test HTTP endpoints: `request(app).get('/api/...')`
- Config in `packages/api/vitest.config.js`
- Run: `npm run test` (from root or packages/api)

---

## Testing Strategy

- **API tests (Vitest + Supertest)**: Already configured, add tests as features are built
- **E2E tests (Playwright)**: Setup from week 2
- Add tests alongside each feature, not after
- E2E tests for the full user flow:
  1. Landing page loads correctly
  2. Character input → sends request → loading screen appears
  3. Dashboard renders with score, stats, gear, coaching
  4. Share button generates correct link
  5. Mobile responsive works on all screens
- API tests:
  1. Public route /character/:region/:realm/:name returns valid data
  2. Rate limiter works correctly under load
  3. Graceful error handling when WarcraftLogs/Raider.io is down
- Goal: Week 5 is ONLY for polish and promotion, zero bug hunting

---

## Analysis & Planning

- **[ANALYSIS.md](ANALYSIS.md)** — Full competitive analysis, launch strategy, security audit, architecture review, pre-launch checklist
- **[AGENT-TASKS.md](AGENT-TASKS.md)** — 7 detailed improvement tasks ready for agent execution
- **[FOUNDATIONS.md](FOUNDATIONS.md)** — Product decisions and design foundations

---

_Last updated: February 12, 2026 — Analysis document added_
