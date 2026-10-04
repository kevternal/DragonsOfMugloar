---
title: 'NPC: decision tree v3.4 (loss base 75, no +1 items)'
type: 'feature'
ticket: ''
created: '2026-10-04'
status: 'built'
baseline_revision: 'd1d04776d9fdaee608f571ec8c794e8fcf1d6e4a'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-game-backend/plan-npc-tree-v31.md'
  - '{project-root}/_bmad-output/shared-mugloar-game/strategy-findings.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** In live probes, every losing v3.2 game bought 7–22 +1 level items (100 gold and a turn each, easing about 3% of ads), while the 1M game bought none. A loss cost of 50 also let the NPC take risky jobs too often.

**Approach:** Two changes to `Strategy` (tree v3.2 → v3.4); everything else stays as committed.
1. **Never buy +1 items.** Steps 4 (2 lives, no safe ad) and 6 (all-deadly board) buy only a +2 item, at 350+ gold. Otherwise the tree falls through to solving.
2. **Loss base 75.** The best-value formula becomes `winPct × reward − (100 − winPct) × (75 + best safe reward)`, up from 50.

**Probe evidence:** at the 100k target, v3.4 reached 100k in 1 of 3 games, and its losses ended at 12,315 and 20,975 (v3.2: 1 of 6, losses at 9,610–13,409). Penalty 100 was tried and died at 7,533. The user chose to ship v3.4.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 30 lines in `Strategy.java` plus test updates.

- `Strategy.java`: `POTION_LOSS = 50` is now `LOSS_BASE = 75`, `GOLD_PLUS1` and the +1 branch of `levelItem` are removed, and the Javadoc says tree v3.4.
- `StrategyTest`: the two +1 tests now assert a solve below 350 gold. The long-shot test now expects the 63%/70 job, which the user had preferred. The loss-cost comments and values are updated to base 75.
- strategy-findings.md: new sections "Loss penalty and +1 items" and "Tree v3.4", which the code comments cite.

## Review Triage Log

**Pass 1 (quick):** low 9, all patched

- Class Javadoc and test Javadoc still said v3.2. Now v3.4.
- The `LOSS_BASE` comment claimed "75 beat 50, 65, 100 [V]", but the cited doc marks that ranking [U]. Reworded to "best results in a few games; ranking [U]".
- Two comments cited "Tree v3.4" for data held in "Loss penalty and +1 items". Both citations fixed.
- The 7b inline comment said "a potion and a turn". It now says LOSS_BASE plus a turn.
- The tie-break test no longer tied at base 75. New ads tie at 75 (87×21 − 13×75 = 852 = 72×41 − 28×75), so the win-rate and expiry tie-breaks are exercised again.
- `allDeadlyBelow150SolvesByValue` named a removed threshold. Renamed `allDeadlyWithLittleGoldSolvesByValue`.
- The removed fall-through (350+ gold, no +2 in the shop) was untested. Added `richButNoPlus2InTheShopSolvesInsteadOfBuyingAPlus1`.
- `strategy-findings.md` was untracked, but the code cites it. Committed with this change.
- The "Tree v3.4" findings section had no provenance tag. Tagged.

## Verification

**Commands:**
- `cd backend && ./mvnw -q test` -- expected: BUILD SUCCESS.
