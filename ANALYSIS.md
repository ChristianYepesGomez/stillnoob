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

| Product          | Strength                                                                                 | Weakness                                                                                                                       | Revenue Model              |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| **WarcraftLogs** | Gold standard for raw combat data. Multi-report analysis (All Stars, character rankings) | No coaching. Data dumps, not advice. Multi-report requires 9€/mo premium                                                       | Ads (free) + Premium 9€/mo |
| **WoWAnalyzer**  | Per-spec rotation analysis, open source                                                  | Massive maintenance burden (per-spec modules break each patch). Limited spec coverage. Dead/stale specs. No cross-fight trends | Free (donations)           |
| **Archon**       | Meta builds, tier lists, BiS guides                                                      | Generic — not personalized. "Best for the average player" not "best for YOU"                                                   | Ads                        |
| **Wipefest**     | Was great for raid wipe analysis                                                         | **Dead** (shut down). Lesson: single-developer maintenance risk                                                                | N/A                        |
| **Raider.io**    | M+ rankings, dungeon scores, recruitment tool                                            | M+ focused only. No raid coaching. No improvement advice                                                                       | Ads + Premium              |

### StillNoob's Unique Position

**Nobody does automated personalized coaching from real player data.**

Key differentiators:

1. **"Spotify Wrapped" for WoW** — seasonal summaries, shareable score badges, progress over time
2. **Skill-adapted advice** — different tips for a 30-score player vs an 80-score player (not one-size-fits-all)
3. **Multi-report trend analysis** — "you're dying 40% less this month" vs WCL's single-report view
4. **Actionable, not analytical** — "Use Healthstone when below 30% HP" not "Your DTPS was 12,345"
5. **Score gamification** — 0-100 score with tiers creates addiction loop ("I went from Decent to Skilled!")

### Pricing Strategy (Recommended)

| Tier         | Price | Includes                                                                    |
| ------------ | ----- | --------------------------------------------------------------------------- |
| **Free**     | $0    | Score + 2-week history + basic tips + shareable badge                       |
| **Premium**  | 4€/mo | Full history + boss-by-boss breakdown + weekly trends + all recommendations |
| **Pro/Team** | 7€/mo | Guild dashboard + team comparison + priority background scanning            |

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

| Channel                          | Expected Users | Effort                             |
| -------------------------------- | -------------- | ---------------------------------- |
| r/CompetitiveWoW post            | 200-400        | Medium (need quality post)         |
| r/wownoob post                   | 100-200        | Low (beginner audience loves this) |
| r/wow launch post                | 300-500        | High (competitive, needs timing)   |
| Discord communities              | 50-100         | Medium (manual outreach)           |
| Word of mouth (shareable scores) | 100-300        | Zero (viral)                       |

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

| Severity | Count | Status              |
| -------- | ----- | ------------------- |
| CRITICAL | 1     | ✅ Fixed (Feb 2026) |
| HIGH     | 4     | ✅ Fixed (Feb 2026) |
| MEDIUM   | 2     | ✅ Fixed (Feb 2026) |
| LOW      | 1     | Backlog             |

---

### ✅ FIXED — OAuth State CSRF (Account Takeover)

**Status:** Fixed. OAuth state is now HMAC-SHA256 signed with `OAUTH_STATE_SECRET` environment variable. Verification uses `crypto.timingSafeEqual()` to prevent timing attacks. Both Blizzard and WCL callbacks validate state before processing.

---

### ✅ FIXED — Report Visibility Bypass

**Status:** Fixed. Three visibility levels enforced: `public` (anyone), `private` (owner only), `guild` (guild members only). Uses `optionalAuth` middleware and returns 404 (not 403) for information hiding.

---

### ✅ FIXED — Plaintext OAuth Tokens in DB

**Status:** Fixed. Tokens encrypted at rest with AES-256-GCM (random 12-byte IV, 16-byte auth tag). Uses `ENCRYPTION_KEY` env var (required). Helper functions `encryptToken()`/`decryptToken()` in `services/encryption.js`.

---

### ✅ FIXED — No Refresh Token Reuse Detection

**Status:** Fixed. Family-based tracking implemented. Each login creates a `tokenFamily` UUID. On refresh: if token already `used=true`, ALL tokens in the family are deleted (forced re-login). Same family UUID preserved across rotations.

---

### ✅ FIXED — Hardcoded JWT Secret Fallbacks

**Status:** Fixed. Both `JWT_SECRET` and `JWT_REFRESH_SECRET` are required env vars. App crashes on startup if missing (fail-secure). Separate secrets for access vs refresh tokens.

---

### ✅ FIXED — Open Guild Join

**Status:** Fixed. Guild join requires invite code (crypto-random UUID.slice(0,8)). Returns 403 on invalid code. Idempotent via `onConflictDoNothing()`.

---

### ✅ FIXED — OAuth Callbacks Lack Authentication

**Status:** Fixed. OAuth state signing with HMAC addresses this. Callback endpoints now have `authLimiter` rate limiting applied.

---

### ✅ FIXED — No Rate Limiting on Heavy Endpoints

**Status:** Fixed. Rate limiting applied: general API (60/min), auth (20/15min), import (10/5min), analysis (15/min).

---

## 4. Architecture & Scalability

### ✅ FIXED — Sequential Fight Processing

**Status:** Fixed. Uses GraphQL aliases to batch all fights into single API calls: `getBatchFightStats()` and `getBatchExtendedFightStats()`. Report import now uses ~3 WCL API calls total (report data + 2 batch stat calls) instead of 2N+1.

---

### ✅ FIXED — Analysis Caching

**Status:** Fixed. In-memory Map cache with 5-minute TTL, max 200 entries. Cache key includes `characterId:weeks:bossId:difficulty:visibilityFilter`. Auto-evicts oldest entry when full. `invalidateAnalysisCache(characterId)` called on new report imports. `/analysis/overview` parallelized with `Promise.all()`.

---

### ✅ FIXED — Database Indexes

**Status:** Fixed. All critical indexes added: `fight_encounter_idx`, `fight_difficulty_idx`, `fight_time_idx`, `fight_encounter_difficulty_idx` (composite), `perf_char_idx`, `perf_char_fight_idx`, `mplus_snap_time_idx`.

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

| Users   | Infra                                      | Monthly Cost | Key Actions                               |
| ------- | ------------------------------------------ | ------------ | ----------------------------------------- |
| 0-100   | Render Free + Turso Free + CF Free         | **$0**       | Current setup. Add indexes + caching      |
| 100-500 | Render Starter ($7)                        | **$7**       | Eliminate cold starts. Batch WCL calls    |
| 500-2K  | Render Standard ($25) + Turso Scaler ($29) | **$54**      | Add Redis for caching. Optimize SQL       |
| 2K-10K  | Render Pro + Workers + dedicated DB        | **$200-400** | Background workers, CDN for static assets |
| 10K+    | Multi-region, dedicated instances          | **$1K-3K**   | Distributed caching, read replicas        |

---

## 5. Pre-Launch Checklist

### Must Do Before Launch (Mar 17)

- [x] **CRITICAL: Fix OAuth state CSRF** — HMAC-SHA256 signed state ✅
- [x] **HIGH: Fix report visibility bypass** — 3-level visibility checks ✅
- [x] **HIGH: Remove JWT secret fallbacks** — fail-fast on missing env vars ✅
- [x] **HIGH: Batch WCL fight fetching** — GraphQL alias batching ✅
- [x] **HIGH: Add database indexes** — all critical indexes added ✅
- [x] **HIGH: Add analysis caching** — 5-min TTL with visibility-aware cache key ✅
- [x] **MEDIUM: Rate limit heavy endpoints** — import, analysis, OAuth callbacks ✅
- [ ] **Test all OAuth flows end-to-end** — Blizzard, WCL linking
- [ ] **Test public character route** — this is the viral entry point, must be flawless
- [ ] **Frontend production build** — deploy React app to Cloudflare Pages
- [ ] **Configure production env vars** — FRONTEND_URL, API_URL, all OAuth callbacks
- [ ] **Verify Render auto-deploy** — push to main → API updates within minutes
- [ ] **Test on mobile** — 60%+ of WoW community browses on mobile
- [ ] **Prepare Reddit posts** — draft, get feedback, schedule for launch day

### Should Do Before Launch

- [x] Encrypt OAuth tokens at rest — AES-256-GCM ✅
- [x] Add refresh token reuse detection — family-based tracking ✅
- [x] Implement guild invite/approval system — invite codes ✅
- [x] Run `npm run lint` and fix all warnings — 0 warnings ✅
- [ ] Add loading animation for cold starts
- [ ] Set up Sentry error monitoring
- [ ] Run `npm run format:check` and fix all formatting

### Nice to Have

- [ ] Google/Discord OAuth
- [ ] Email verification
- [ ] Playwright E2E tests
- [ ] SEO blog posts
- [ ] AI-generated coaching text (LLM integration)

---

_This document should be reviewed and updated as items are completed. Security fixes are the highest priority — ship without features before shipping with vulnerabilities._
