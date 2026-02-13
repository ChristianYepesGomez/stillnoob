# StillNoob Engine Audit Report

**Date:** Feb 13, 2026
**Player analyzed:** Løliløp — Assassination Rogue, Sanguino-EU, ilvl 631
**Method:** Independent expert analysis vs. simulated engine output

---

## 1. Player Profile (Raider.io Data)

| Field                  | Value                                              |
| ---------------------- | -------------------------------------------------- |
| Class/Spec             | Rogue / Assassination                              |
| Race                   | Undead (Horde)                                     |
| Server                 | Sanguino-EU                                        |
| ilvl                   | 631 equipped                                       |
| Raid (Nerub'ar Palace) | 4/8 Mythic, 8/8 Heroic                             |
| Raid (Current tier)    | 0/8 everywhere (Manaforge Omega, LOU, BRD)         |
| M+ Season TWW-3        | Score 0, zero runs                                 |
| Tier Set               | 4pc K'areshi Phantom (Head, Shoulder, Hands, Legs) |

---

## 2. My Independent Expert Analysis

### Gear Assessment

**Enchants:**
| Slot | Enchant | Verdict |
|------|---------|---------|
| Head | NONE | **MISSING** — should have Nerubian enchant |
| Back | Chant of Winged Grace | OK |
| Chest | Crystalline Radiance | OK |
| Wrist | 72 Avoidance | **SUBOPTIMAL** — Avoidance is a tertiary defensive stat, useless for DPS. Should be Haste/Mastery leech |
| Legs | 61 Agi/Str & 59 Sta | OK (standard armor kit) |
| Feet | NONE | **MISSING** — should have movement speed or stat enchant |
| Ring 1 | 21 Mastery | OK (Mastery is #2 stat) |
| Ring 2 | 21 Mastery | OK |
| Main Hand | Authority of Radiant Power | OK (BiS) |
| Off Hand | Authority of Radiant Power | OK (BiS) |

**Missing enchants: 2** (Head, Feet)
**Suboptimal enchants: 1** (Wrist — Avoidance instead of DPS stat)

**Gems:**
| Slot | Gems | Verdict |
|------|------|---------|
| Neck | Mast/Crit + **Vers/Mast** | Vers gem is suboptimal — Vers is lowest priority for Assa |
| Ring 1 | Haste/Mast + Crit/Mast | OK |
| Ring 2 | Meta gem + Mast/Crit | OK |

**Stat Priority Alignment:**

- Assassination priority: **Haste > Mastery > Crit > Versatility**
- Player's gems/enchants: Heavy Mastery focus, some Haste, minimal Vers
- **Verdict: Acceptable** — Mastery is #2 stat, Haste shows up in some gems. The one Vers gem is the only issue.

**Overall Gear Grade: B+** — Solid tier set, good weapons, good trinkets. Held back by 2 missing enchants, 1 bad enchant, and 1 suboptimal gem.

### Activity Assessment

- **Critical issue:** Player has ZERO activity in current tier. No raids, no M+.
- With 4/8M experience and 631 ilvl, they could immediately start Heroic current tier and push 10-12 M+ keys.
- **Recommendation:** Import current logs (if any exist) or start raiding/pushing M+ for vault rewards.

### What I Would Tell This Player (Top 5 Tips)

1. **Start raiding current content** — 0 bosses in current tier with 4/8M experience means you're falling behind
2. **Enchant Head and Feet** — 2 free stat upgrades sitting on the table
3. **Replace Wrist enchant** — Avoidance does nothing for your DPS. Get Haste or Mastery
4. **Do Mythic+ for vault** — Score 0 means no weekly vault rewards from M+
5. **Fix Vers gem in neck** — Replace with Haste/Mastery hybrid, Vers is your worst stat

---

## 3. What StillNoob's Engine Would Produce

### Scenario A: No logs imported (most likely current state)

Since the player has 0/8 in all current raids:

- `totalFights = 0`
- `playerLevel = 'beginner'` (immediate return, line 557)
- `score = 0`, tier = **'Noob'**
- `recommendations = { primaryTips: [], secondaryTips: [] }`
- **Result: BLANK PAGE — zero useful coaching**

### Scenario B: Old Nerub'ar Palace logs imported

If they import their NP logs (old tier), the engine would work but:

- Boss data would be from old encounters (not current raid)
- Player level detection influenced by broken M+ score (0) and consumable bug (see below)
- Tips would reference old bosses that are no longer relevant

### Scenario C: Build analysis only (gear data from Blizzard API)

The build analysis WOULD fire and detect:

- **gear_missing_enchants:** 2 missing (Head, Feet) — CORRECT
- **gear_wrong_stat_priority:** Probably NOT triggered (top stats are Haste/Mastery, both in top-2)
- **gear_low_ilvl_slot:** NOT triggered (max gap is 13 levels, threshold is 15)
- **gear_stat_vs_meta:** Only if specMeta cache exists

### What the engine MISSES that I caught:

1. ❌ **Suboptimal wrist enchant** — Engine only checks presence, not quality
2. ❌ **Vers gem suboptimal** — Engine doesn't audit individual gem choices
3. ❌ **Player inactivity** — No tip for "you haven't raided in X weeks"
4. ❌ **M+ inactivity** — No tip for "do M+ for vault rewards"
5. ❌ **Tier-to-tier context** — Can't say "you were 4/8M last tier, why not raiding now?"

---

## 4. Bugs Found (Sorted by Severity)

### CRITICAL

#### BUG-01: `healthPotions` is ALWAYS 0 — never populated from WCL data

**File:** [analysis.js:59](packages/api/src/services/analysis.js#L59)

The `healthPotions` field is initialized to 0 but never assigned a value. WCL's Summary table provides `potionUse` (combat potions) and `healthstoneUse`, but not `healthPotionUse` separately.

```js
// Line 59: initialized
playerData[name] = { ..., healthPotions: 0, ... };

// Lines 84-95: potionUse → combatPotions, healthstoneUse → healthstones
// BUT healthPotions is NEVER set!
playerData[p.name].combatPotions = p.potionUse || 0;
playerData[p.name].healthstones = p.healthstoneUse || 0;
// healthPotions = ??? ← MISSING
```

**Impact chain:**

1. `healthPotionRate` always = 0% in all queries
2. `consumableScore` max is **80**, not 100 (20% weight dead)
3. `good_preparation` tip IMPOSSIBLE (requires `healthPotionRate >= 60`)
4. Players can NEVER receive the "Excellent consumable preparation!" positive feedback
5. `defensive_gap` tip text shows `healthPotionRate: 0%` which is misleading

**Fix:** Either populate healthPotions from WCL data (may require `events(type: "healing")` filtered by potion abilities), or remove healthPotion from the consumable weights and redistribute the 20% weight.

---

#### BUG-02: Raid median DPS includes ALL roles (tanks/healers)

**File:** [analysis.js:139-148](packages/api/src/services/analysis.js#L139-L148)

```js
const allDps = [];
for (const data of Object.values(playerData)) {
  if (data.damageDone > 0 && fightDurationSec > 0) allDps.push(data.damageDone / fightDurationSec);
}
```

The median DPS calculation includes ALL players — tanks, healers, and DPS. This means:

- **DPS players** always appear to "beat the median" (inflated dpsVsMedianPct ~110-130%)
- **Tanks/Healers** always appear "below median" (deflated ~30-60%)
- The `performanceRaw` score and `boss_weakest_dps` tips are skewed

In a typical 20-person raid (2T/4H/14DPS):

- DPS doing 100k looks like ~120% vs median (because tanks at 40k and healers at 15k drag median down)
- This makes dpsVsMedianPct unreliable for all roles

**Fix:** Either filter by role when computing median (requires knowing each player's role, which WCL provides in masterData), or weight the metric less and rely more on parse percentiles.

---

#### BUG-03: Player with 0 fights = 'beginner' regardless of raider.io data

**File:** [analysis.js:557](packages/api/src/services/analysis.js#L557)

```js
export function detectPlayerLevel(summary, bossBreakdown, raiderIO) {
  if (!summary || summary.totalFights === 0) return 'beginner';
  // ...rest of detection never runs
```

A 4/8 Mythic player who hasn't imported logs gets classified as `beginner`. The raider.io data (which HAS progression info) is completely ignored because the function returns early.

**Fix:** Even with 0 fights, use raiderIO data for level detection:

```js
if (!summary || summary.totalFights === 0) {
  // Still check raiderIO for baseline level
  if (raiderIO) {
    const progression = raiderIO.raidProgression?.[0];
    if (progression?.mythic > 0) return 'intermediate'; // at minimum
    if (progression?.heroic >= 4) return 'intermediate';
  }
  return 'beginner';
}
```

---

### HIGH

#### BUG-04: CPM threshold is flat — doesn't account for spec APM differences

**File:** [analysis.js:869-876](packages/api/src/services/analysis.js#L869-L876)

```js
if (summary.avgCpm > 0 && summary.avgCpm < 30) {
  // triggers warning
}
```

30 CPM threshold is applied to ALL specs equally. But specs have wildly different natural CPMs:

- **High APM specs** (Outlaw Rogue, Fury Warrior, Windwalker): 45-60 CPM
- **Low APM specs** (Assassination Rogue, Affliction Lock, Balance Druid): 25-35 CPM

An Assassination Rogue at 28 CPM is playing correctly but would trigger a "low CPM" warning.

**Fix:** Define per-spec CPM baselines in `specData.js`:

```js
'Assassination': {
    ...,
    expectedCpm: { low: 22, normal: 28, high: 35 },
}
```

---

#### BUG-05: Enchant quality not assessed — DPS with defensive enchants passes audit

**File:** [buildAnalysis.js:100-111](packages/api/src/services/buildAnalysis.js#L100-L111)

The engine only checks if an enchant EXISTS on each slot, not whether it's appropriate for the player's role/spec. Løliløp has "72 Avoidance" on wrists — a completely useless tertiary stat enchant for a DPS player — but this passes the audit.

**Fix:** Add an enchant quality check: flag tertiary stat enchants (Avoidance, Leech, Speed) on DPS players as suboptimal, or compare against specMeta common enchants.

---

#### BUG-06: `good_preparation` tip is unreachable

**File:** [analysis.js:932](packages/api/src/services/analysis.js#L932)

```js
if (summary.healthPotionRate >= 60 && ...)
```

Direct consequence of BUG-01. Since `healthPotionRate` is always 0, this condition can NEVER be true. Players NEVER get positive reinforcement for consumable usage.

**Fix:** Remove `healthPotionRate >= 60` condition, or fix BUG-01 first.

---

### MEDIUM

#### BUG-07: No detection of player inactivity

The engine has no concept of "this player hasn't raided in X weeks." If a player has old data but nothing recent, they still see old analysis. There's no proactive nudge like "You haven't imported logs in 3 weeks."

**Fix:** Compare latest fight timestamp against current date. If gap > 2 weeks, add a tip.

---

#### BUG-08: No M+ activity nudge

If a player has raid data but 0 M+ score, there's no recommendation to do M+ for vault rewards. This is a major coaching gap for a game where M+ vault is a core gearing path.

**Fix:** In the analysis route, if `raiderIO.mythicPlus.score === 0` and the player has raid data, add a general tip about M+ vault.

---

#### BUG-09: Survival score too punishing for progression

**File:** [analysis.js:509-510](packages/api/src/services/analysis.js#L509-L510)

```js
const survivalRaw = Math.min(100, Math.max(0, (1 - summary.deathRate / 0.5) * 100));
```

- 0.25 deaths/fight = 50% survival score
- 0.5+ deaths/fight = 0% survival score

During Mythic progression, dying 1 in 4 pulls is NORMAL. This penalizes progression raiders unfairly and drags their StillNoob Score down.

**Fix:** Scale based on difficulty. Mythic progression deaths should be weighted less harshly:

```js
const deathPenaltyDivisor = hasMythicKills ? 0.7 : 0.5;
```

---

#### BUG-10: Interrupt tip requires 5+ fights (inconsistent with min 1 fight philosophy)

**File:** [analysis.js:906](packages/api/src/services/analysis.js#L906)

```js
if (summary.avgInterrupts < 1 && summary.totalFights >= 5) {
```

The engine was designed for `minFights: 1` (season-start friendly), but the interrupt tip won't show until 5 fights. Players who never interrupt in their first 4 fights get no feedback.

**Fix:** Lower to `totalFights >= 2` or `>= 3`.

---

#### BUG-11: Utility score doesn't account for class capabilities

**File:** [analysis.js:516-517](packages/api/src/services/analysis.js#L516-L517)

```js
const avgUtil = (summary.avgInterrupts || 0) + (summary.avgDispels || 0);
const utilityRaw = Math.min(100, avgUtil * 25); // 4+ combined = 100
```

- Rogues can't dispel
- Many specs have limited interrupt access (e.g., 45s cooldown vs 15s)
- Tanks naturally interrupt more (melee range, priority role)
- Healers dispel more (it's their job)

A rogue maxes out at 4 interrupts + 0 dispels = 100 score, same as a healer with 0 interrupts + 4 dispels. But the expectations are very different.

**Fix:** Weight interrupts and dispels separately, adjust expectations based on role.

---

### LOW

#### BUG-12: `AUTO_ATTACK_PATTERNS` constant exists but is never used

**File:** [constants.js:69](packages/shared/src/constants.js#L69)

```js
export const AUTO_ATTACK_PATTERNS = /^(Melee|Auto Shot|Shoot)$/i;
```

This regex was created to exclude auto-attacks from CPM but is never imported or used anywhere in the analysis pipeline. If WCL's Casts table includes auto-attacks, CPM could be inflated for melee classes.

**Fix:** Verify whether WCL Casts table includes auto-attacks. If yes, use this pattern to filter. If no, remove the dead constant.

---

#### BUG-13: Individual gem choices not audited

**File:** [buildAnalysis.js](packages/api/src/services/buildAnalysis.js)

The engine checks for missing gems (empty sockets) but never evaluates gem stat choices. A Vers gem on an Assassination Rogue (where Vers is worst stat) passes without comment.

**Fix:** Compare each gem's primary stat against spec priority. Flag gems that provide the spec's lowest-priority stat.

---

#### BUG-14: Augment Rune regex may miss TWW-era names

**File:** [constants.js:82](packages/shared/src/constants.js#L82)

```js
augmentRune: /augment rune/i,
```

In TWW, augment runes may have specific names like "Crystallized Augment Rune" or "Algari Augment Rune." The regex `/augment rune/i` should catch these as substrings, but worth verifying against actual TWW buff names.

---

#### BUG-15: Food buff regex — coverage uncertainty

**File:** [constants.js:81](packages/shared/src/constants.js#L81)

```js
food: /well fed|sated|nourished|satisfecho|alimentado/i,
```

In TWW, food buffs have specific names like "Grand Banquet of the Kah'kara" or "Feast of the Midnight Masquerade." The "Well Fed" buff is the standard food buff effect name and SHOULD cover all food in any locale, but the Spanish localized names (`satisfecho`, `alimentado`) need verification.

---

## 5. Missing Features (Coaching Quality Gaps)

These aren't bugs but gaps between what a human coach would say and what the engine produces:

| #    | Gap                                           | Impact                                    | Effort |
| ---- | --------------------------------------------- | ----------------------------------------- | ------ |
| F-01 | No "start raiding" nudge for inactive players | High — player sees blank page             | Low    |
| F-02 | No "do M+ for vault" recommendation           | High — misses core gearing path           | Low    |
| F-03 | No cross-tier progression awareness           | Medium — 4/8M player = "Noob"             | Medium |
| F-04 | No spec-specific CPM thresholds               | High — false warnings for DoT specs       | Medium |
| F-05 | No enchant quality assessment (only presence) | Medium — bad enchants pass                | Medium |
| F-06 | No individual gem auditing                    | Low — rare edge case                      | Medium |
| F-07 | No role-filtered raid median                  | High — inflated DPS, deflated tank/healer | High   |
| F-08 | No difficulty-scaled death tolerance          | Medium — prog deaths over-penalized       | Low    |
| F-09 | No "import your logs" guidance for new users  | High — empty dashboard unhelpful          | Low    |

---

## 6. Priority Fix Roadmap

### Phase 1: Quick Wins (< 1 hour each)

1. **Fix BUG-01** — Remove healthPotion from consumable weights OR properly populate it
2. **Fix BUG-06** — Remove unreachable healthPotionRate condition from good_preparation
3. **Fix BUG-10** — Lower interrupt tip threshold to 2 fights
4. **Add F-01** — "No recent data" tip when totalFights = 0
5. **Add F-02** — M+ vault nudge when M+ score = 0

### Phase 2: Medium Effort (1-3 hours each)

6. **Fix BUG-03** — Use raiderIO data for level detection even with 0 fights
7. **Fix BUG-04** — Per-spec CPM baselines in specData.js
8. **Fix BUG-05** — Enchant quality assessment (flag tertiary stats on DPS)
9. **Fix BUG-09** — Scale death tolerance by difficulty

### Phase 3: Architecture Improvements (3+ hours each)

10. **Fix BUG-02** — Role-filtered raid median DPS calculation
11. **Fix BUG-11** — Role-aware utility scoring
12. **Add F-03** — Cross-tier progression tracking

---

## 7. Summary

### What the engine does WELL:

- 3-tier tip architecture (boss-specific > cross-pattern > general) is solid
- Priority system (bigger problems shown first) works correctly
- Player level detection is well-weighted (when data exists)
- Boss-specific tips (uptime drops, death spikes, excess damage) are genuinely useful
- Gear analysis catches missing enchants and gems
- i18n is complete and tip text is well-written in both EN and ES

### What needs fixing URGENTLY (before launch):

1. **healthPotions always 0** → consumableScore capped at 80, good_preparation unreachable
2. **Raid median includes all roles** → performance metrics are misleading
3. **0-fight players = beginner** → disrespects experienced players without recent logs
4. **Flat CPM thresholds** → false warnings for DoT-based specs
5. **No inactivity nudge** → blank pages for new/returning users

### Bottom line:

The coaching engine's architecture is sound but has 5 data pipeline/threshold bugs that degrade the experience significantly. The most impactful fix is BUG-01 (healthPotions always 0) because it creates a cascade of downstream problems. BUG-02 (raid median) is the hardest to fix but most important for accuracy.

---

_Report generated by Claude during overnight code audit session._
