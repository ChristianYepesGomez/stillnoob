# StillNoob — Comprehensive Pre-Launch Analysis

> Generated: February 12, 2026
> Launch target: March 17, 2026 (WoW Midnight Season 1)

---

## Table of Contents

1. [Competitive Landscape](#1-competitive-landscape)
2. [Launch Strategy](#2-launch-strategy)
3. [Security Audit](#3-security-audit)
4. [Architecture & Scalability](#4-architecture--scalability)
5. [Pre-Launch Checklist](#5-pre-launch-checklist)

---

## 1. Competitive Landscape

### Direct Competitors

| Product | Strength | Weakness | Revenue Model |
|---------|----------|----------|---------------|
| **WarcraftLogs** | Gold standard for raw combat data. Multi-report analysis (All Stars, character rankings) | No coaching. Data dumps, not advice. Multi-report requires 9€/mo premium | Ads (free) + Premium 9€/mo |
| **WoWAnalyzer** | Per-spec rotation analysis, open source | Massive maintenance burden (per-spec modules break each patch). Limited spec coverage. Dead/stale specs. No cross-fight trends | Free (donations) |
| **Archon** | Meta builds, tier lists, BiS guides | Generic — not personalized. "Best for the average player" not "best for YOU" | Ads |
| **Wipefest** | Was great for raid wipe analysis | **Dead** (shut down). Lesson: single-developer maintenance risk | N/A |
| **Raider.io** | M+ rankings, dungeon scores, recruitment tool | M+ focused only. No raid coaching. No improvement advice | Ads + Premium |

### StillNoob's Unique Position

**Nobody does automated personalized coaching from real player data.**

Key differentiators:
1. **"Spotify Wrapped" for WoW** — seasonal summaries, shareable score badges, progress over time
2. **Skill-adapted advice** — different tips for a 30-score player vs an 80-score player (not one-size-fits-all)
3. **Multi-report trend analysis** — "you're dying 40% less this month" vs WCL's single-report view
4. **Actionable, not analytical** — "Use Healthstone when below 30% HP" not "Your DTPS was 12,345"
5. **Score gamification** — 0-100 score with tiers creates addiction loop ("I went from Decent to Skilled!")

### Pricing Strategy (Recommended)

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 | Score + 2-week history + basic tips + shareable badge |
| **Premium** | 4€/mo | Full history + boss-by-boss breakdown + weekly trends + all recommendations |
| **Pro/Team** | 7€/mo | Guild dashboard + team comparison + priority background scanning |

**Rationale:** WCL Premium is 9€/mo for multi-report analysis. StillNoob delivers better coaching at half the price. Free tier must be generous enough for viral sharing (the score badge IS the marketing).

### Market Opportunity

- WCL has ~2M monthly unique visitors
- WoWAnalyzer gets ~500K monthly uniques but declining
- Raider.io dominates M+ but ignores raid coaching
- **Gap:** No product converts raw log data into "here's what you should do differently"
- **Timing:** Midnight expansion S1 launch = massive player return wave

---

## 2. Launch Strategy

### Phase 1: Pre-Launch (Now → Mar 10)

**Build the waitlist and early community:**

1. **Reddit Presence** (r/wow, r/CompetitiveWoW, r/wownoob)
   - Post "I built a tool that reads your WCL logs and tells you exactly what to improve" on r/CompetitiveWoW
   - Post "Free WoW coaching tool for players who want to improve" on r/wownoob
   - **Do NOT spam** — one high-quality post per subreddit, respond to every comment
   - Include a link to the public character lookup (no login required)

2. **Discord Communities**
   - Class-specific discords (Warlock, Mage, etc.) — share as a useful tool
   - Wowhead discord, Method discord, Liquid discord
   - **Approach:** "Hey, I built this tool, would love feedback from experienced players"

3. **SEO Groundwork**
   - Target: "wow log analysis", "wcl coaching", "wow performance analysis", "how to improve wow dps"
   - Each public character page is an SEO-indexable URL: `stillnoob.com/character/eu/kazzak/playername`
   - Blog posts (if time): "How to read your WarcraftLogs — a beginner's guide"

### Phase 2: Launch Week (Mar 17-23)

**Coincide with WoW Midnight Season 1:**

1. **Launch Day Post** on r/wow — "I built a free coaching tool for the new season — paste your character name and get a personalized score"
2. **YouTube/Twitch** — Reach out to mid-tier WoW content creators (10K-100K subs). Offer early access
3. **Viral mechanic:** Shareable score badges → users post their score on social → friends want to check theirs
4. **Discord bot announcement** in WoW communities: "Season 1 is here — check your StillNoob Score"

### Phase 3: Growth (Mar 24 → Apr 30)

1. **Iterate on feedback** — fix bugs reported in the first week, improve recommendations
2. **Content marketing** — weekly blog posts about Season 1 meta, class performance
3. **Feature requests** — community-driven roadmap
4. **Monetization:** Keep everything free for 3 months. Introduce Premium at month 4 when users are hooked

### First 1000 Users Tactics

| Channel | Expected Users | Effort |
|---------|---------------|--------|
| r/CompetitiveWoW post | 200-400 | Medium (need quality post) |
| r/wownoob post | 100-200 | Low (beginner audience loves this) |
| r/wow launch post | 300-500 | High (competitive, needs timing) |
| Discord communities | 50-100 | Medium (manual outreach) |
| Word of mouth (shareable scores) | 100-300 | Zero (viral) |

### Viral Loop Design

```
User searches character → Gets free score + badge
    → Shares on Discord/Reddit ("I got 72 — Skilled tier!")
        → Friend clicks link → Searches their character
            → Gets their score → Shares it too
                → Loop continues
```

**Critical:** The free tier MUST include the shareable score badge. This is the growth engine.

---

## 3. Security Audit

### Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | Must fix before launch |
| HIGH | 4 | Must fix before launch |
| MEDIUM | 2 | Fix in first sprint post-launch |
| LOW | 1 | Backlog |

---

### CRITICAL: OAuth State CSRF (Account Takeover)

**Files:** `packages/api/src/routes/auth.js` — Lines 255, 338

**Issue:** OAuth state parameter is just `base64url(JSON.stringify({userId}))` — no HMAC signature.

```javascript
// Line 255 - Blizzard OAuth
const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url');

// Line 338 - WCL OAuth
const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url');
```

**Attack:** Attacker crafts `state` with victim's userId → tricks victim into completing OAuth flow → victim's Blizzard/WCL account gets linked to attacker's StillNoob account.

**Fix:**
```javascript
import crypto from 'crypto';
const HMAC_KEY = process.env.JWT_SECRET;

function signState(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_KEY).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state) {
  const [payload, sig] = state.split('.');
  const expected = crypto.createHmac('sha256', HMAC_KEY).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Invalid state');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}
```

---

### HIGH: Report Visibility Bypass

**File:** `packages/api/src/routes/reports.js` — Lines 202-223

**Issue:** `GET /api/v1/reports/:code` returns any report regardless of visibility settings.

```javascript
// NO VISIBILITY CHECK — returns private/guild reports to anyone
router.get('/:code', async (req, res) => {
  const report = await db.select().from(reports).where(eq(reports.wclCode, req.params.code)).get();
  // ... returns full report data without checking visibility
});
```

**Fix:** Add visibility enforcement:
```javascript
if (report.visibility === 'private' && report.importedBy !== req.user?.id) {
  return res.status(403).json({ error: 'Report not accessible' });
}
if (report.visibility === 'guild' && report.guildId) {
  const membership = await db.select().from(guildMembers)
    .where(and(eq(guildMembers.guildId, report.guildId), eq(guildMembers.userId, req.user?.id))).get();
  if (!membership) return res.status(403).json({ error: 'Report not accessible' });
}
```

---

### HIGH: Plaintext OAuth Tokens in DB

**File:** `packages/api/src/db/schema.js` — Lines 21-33

**Issue:** Blizzard and WCL OAuth access/refresh tokens stored in plaintext in `auth_providers` table.

**Risk:** Database compromise → attacker can impersonate users on Blizzard/WCL.

**Fix:** Encrypt tokens at rest using AES-256-GCM with `process.env.ENCRYPTION_KEY`. Create helper functions `encryptToken()`/`decryptToken()` and use them when writing/reading `auth_providers`.

---

### HIGH: No Refresh Token Reuse Detection

**File:** `packages/api/src/routes/auth.js` — Lines 144-204

**Issue:** Token rotation deletes old token and issues new one, but no token family tracking. If a token is stolen and used by attacker before legitimate user, the legitimate user's token still works (no detection).

**Fix:** Add `tokenFamily` column to `refresh_tokens` table. On reuse detection (token already consumed), invalidate ALL tokens in that family and force re-login.

---

### HIGH: Hardcoded JWT Secret Fallbacks

**File:** `packages/api/src/middleware/auth.js` — Lines 3, 24, 39

```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
```

**Risk:** If env vars are missing in production, app silently uses well-known dev secrets → anyone can forge JWTs.

**Fix:** Remove fallbacks. Fail fast on startup:
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
```

---

### HIGH: Open Guild Join

**File:** `packages/api/src/routes/guilds.js` — Lines 119-140

**Issue:** Any authenticated user can join any guild without approval or invitation.

**Fix:** Implement invite code system or approval workflow.

---

### MEDIUM: OAuth Callbacks Lack Authentication

**File:** `packages/api/src/routes/auth.js` — Lines 274-275, 357-358

**Issue:** OAuth callback endpoints don't verify the currently-authenticated user matches the userId in the state parameter. Combined with the unsigned state (CRITICAL above), this enables full account takeover.

**Fix:** Fixing the CRITICAL OAuth state signing also addresses this. Additionally, consider adding `authenticateToken` middleware to callback routes.

---

### MEDIUM: No Rate Limiting on Heavy Endpoints

**Issue:** Auth endpoints have rate limiting, but report imports and analysis endpoints (which trigger WCL API calls and heavy SQL) have no rate limiting.

**Fix:** Add rate limiter to `POST /api/v1/reports/import` and `GET /api/v1/analysis/*`.

---

## 4. Architecture & Scalability

### Bottleneck 1: Sequential Fight Processing (CRITICAL)

**Files:** `routes/reports.js:122`, `jobs/scanReports.js:76`

**Problem:** Fight data is fetched one-by-one in a sequential loop:

```javascript
for (const fight of encounterFights) {  // reports.js:122 — SEQUENTIAL
  const [basicStats, extStats] = await Promise.all([
    getFightStats(reportCode, [fight.id]),     // 1 API call
    getExtendedFightStats(reportCode, [fight.id]), // 1 API call
  ]);
}
```

A 10-fight raid = **20 WCL API calls** instead of 2 batched calls.

**Impact at scale:**
- Rate limit: 280 tokens/hour (280 WCL API calls)
- 1 report import = ~20 calls
- 280 / 20 = **14 report imports per hour max**
- With 50 users, each with 2 characters scanning every 30min → exhausted in minutes

**Fix:** Batch `fightIDs` into single GraphQL calls:
```javascript
const allFightIds = encounterFights.map(f => f.id);
const [allBasicStats, allExtStats] = await Promise.all([
  getFightStats(reportCode, allFightIds),      // 1 API call for ALL fights
  getExtendedFightStats(reportCode, allFightIds), // 1 API call for ALL fights
]);
```

**Estimated improvement:** 20x fewer API calls per report.

---

### Bottleneck 2: Zero Analysis Caching (HIGH)

**File:** `services/analysis.js:146-369`

**Problem:** `getCharacterPerformance()` runs **4 SQL aggregation queries** on every request:
1. Summary stats (COUNT, AVG, SUM)
2. Boss breakdown (GROUP BY encounter_id, difficulty)
3. Weekly trends (date windowing + aggregate)
4. Recent fights (LIMIT 20)

No caching. Same character viewed by 10 different users = 40 SQL queries.

**Fix:** In-memory TTL cache (similar to existing Raider.io cache):
```javascript
const analysisCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCharacterPerformance(characterId, options) {
  const key = `${characterId}:${JSON.stringify(options)}`;
  const cached = analysisCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  const result = await runAnalysisQueries(characterId, options);
  analysisCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}
```

Invalidate cache on new report import for that character.

---

### Bottleneck 3: Missing Database Indexes (HIGH)

**File:** `packages/api/src/db/schema.js`

**Current indexes on `fights` table:**
- ✅ UNIQUE on `(reportId, wclFightId)`

**Missing (used in analysis queries):**
- ❌ `encounterId` — used in boss breakdown GROUP BY
- ❌ `difficulty` — used in filtering
- ❌ `startTime` — used in weekly trends ORDER BY
- ❌ Composite `(characterId)` on `fightPerformance` — exists but no composite with fight fields

**Fix:** Add indexes via Drizzle schema:
```javascript
// In fights table definition
index('fight_encounter_idx').on(table.encounterId),
index('fight_difficulty_idx').on(table.difficulty),
index('fight_time_idx').on(table.startTime),
```

Then run `npx drizzle-kit push` to apply.

---

### Bottleneck 4: Render Cold Starts (MEDIUM)

**Problem:** Render free tier sleeps after 15min inactivity. First request after sleep takes ~30 seconds.

**Options:**
| Solution | Cost | Effectiveness |
|----------|------|---------------|
| External pinger (cron-job.org) | Free | Keeps alive but wastes free tier hours |
| Render Starter plan | $7/mo | Always-on, no cold starts |
| Show loading animation | Free | UX workaround — user sees "waking up..." |
| Move to Fly.io free tier | Free | 3 shared VMs, auto-sleep but faster wake |

**Recommendation:** For launch, show a loading animation with "Server waking up..." message. Upgrade to $7/mo Render Starter when you have consistent daily traffic (post-launch week 2).

---

### Scaling Path

| Users | Infra | Monthly Cost | Key Actions |
|-------|-------|-------------|-------------|
| 0-100 | Render Free + Turso Free + CF Free | **$0** | Current setup. Add indexes + caching |
| 100-500 | Render Starter ($7) | **$7** | Eliminate cold starts. Batch WCL calls |
| 500-2K | Render Standard ($25) + Turso Scaler ($29) | **$54** | Add Redis for caching. Optimize SQL |
| 2K-10K | Render Pro + Workers + dedicated DB | **$200-400** | Background workers, CDN for static assets |
| 10K+ | Multi-region, dedicated instances | **$1K-3K** | Distributed caching, read replicas |

---

## 5. Pre-Launch Checklist

### Must Do Before Launch (Mar 17)

- [ ] **CRITICAL: Fix OAuth state CSRF** — sign state with HMAC (auth.js)
- [ ] **HIGH: Fix report visibility bypass** — add ownership/guild checks (reports.js)
- [ ] **HIGH: Remove JWT secret fallbacks** — fail fast if env vars missing (middleware/auth.js)
- [ ] **HIGH: Batch WCL fight fetching** — single call per report, not per fight (reports.js, scanReports.js)
- [ ] **HIGH: Add database indexes** — encounterId, difficulty, startTime on fights table
- [ ] **HIGH: Add analysis caching** — 5-min TTL in-memory cache for character performance
- [ ] **MEDIUM: Rate limit heavy endpoints** — report import + analysis routes
- [ ] **Test all OAuth flows end-to-end** — Blizzard, WCL linking
- [ ] **Test public character route** — this is the viral entry point, must be flawless
- [ ] **Frontend production build** — deploy React app to Cloudflare Pages
- [ ] **Configure production env vars** — FRONTEND_URL, API_URL, all OAuth callbacks
- [ ] **Verify Render auto-deploy** — push to main → API updates within minutes
- [ ] **Test on mobile** — 60%+ of WoW community browses on mobile
- [ ] **Prepare Reddit posts** — draft, get feedback, schedule for launch day

### Should Do Before Launch

- [ ] Encrypt OAuth tokens at rest (HIGH security)
- [ ] Add refresh token reuse detection (HIGH security)
- [ ] Implement guild invite/approval system
- [ ] Add loading animation for cold starts
- [ ] Set up Sentry error monitoring
- [ ] Run `npm run lint` and fix all warnings
- [ ] Run `npm run format:check` and fix all formatting

### Nice to Have

- [ ] Google/Discord OAuth
- [ ] Email verification
- [ ] Playwright E2E tests
- [ ] SEO blog posts
- [ ] AI-generated coaching text (LLM integration)

---

*This document should be reviewed and updated as items are completed. Security fixes are the highest priority — ship without features before shipping with vulnerabilities.*
