package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The NPC's decision rule, decision tree v3.4, as pure functions (strategy-findings.md, "The decision tree"). */
public final class Strategy {

    /**
     * Bait has only been seen at state −10; the guard keeps the estimate at −8 or higher [V]
     * (strategy-findings.md, "Bait ads").
     */
    static final int STATE_FLOOR = -8;
    /** Step 4: with this much gold at 2 lives and no safe ad, a +2 item (never a +1). */
    static final int GOLD_TWO_LIVES_PLUS2 = 350;
    /** Step 5: buy a +2 item from this much gold while some playable ad is not safe. */
    static final int GOLD_PROACTIVE_PLUS2 = 400;
    /**
     * Step 6: on an all-deadly board, a +2 item from 350 gold keeps 50 for a potion [V, n=1]
     * (strategy-findings.md, "Tree v3.1: best run").
     */
    static final int GOLD_DEADLY_PLUS2 = 350;
    /**
     * Step 7b: the base cost of a lost life (a potion and more), plus the turn, valued at the best safe
     * reward. 75 with no +1 items had the best results in a few live probe games; the ranking between
     * bases is [U] (strategy-findings.md, "Loss penalty and +1 items").
     */
    static final int LOSS_BASE = 75;

    /** Step 7: lowest tier (unknown last), then highest reward, then soonest expiry. */
    private static final Comparator<Ad> SAFEST =
            Comparator.comparingInt((Ad ad) -> tierRank(ad))
                    .thenComparing(Comparator.comparingInt(Ad::reward).reversed())
                    .thenComparingInt(Ad::expiresIn)
                    .thenComparing(Ad::adId);

    private Strategy() {
    }

    /** Cost ascending, then API response order (the sort is stable). */
    public static List<ShopItem> shelfOrder(List<ShopItem> items) {
        List<ShopItem> sorted = new ArrayList<>(items);
        sorted.sort(Comparator.comparingInt(ShopItem::cost));
        return sorted;
    }

    /**
     * Tree v3.4; the first match wins:
     * <ol>
     *   <li>Drop bait.</li>
     *   <li>Drop steals when one more would take the state estimate below −8, or bait is on the board,
     *       unless only steals are left.</li>
     *   <li>At 1 life with the potion affordable, buy it.</li>
     *   <li>At 2 lives with no safe playable ad and 350+ gold, the least-bought +2 item.</li>
     *   <li>At 2+ lives with 400+ gold and some playable ad not safe, the least-bought +2 item.</li>
     *   <li>At 2+ lives on an all-deadly board with 350+ gold, the least-bought +2 item.</li>
     *   <li>Gold below the potion's cost: solve the safest ad.</li>
     *   <li>7b. Otherwise solve the best value ad (see {@link #value}).</li>
     *   <li>No playable ad: empty.</li>
     * </ol>
     * Steps 4–6 need at least one playable ad: a purchase can't help an empty board.
     *
     * @param board         the board with ads already known to be gone removed
     * @param purchases     successful buys so far, by item id
     * @param stateEstimate the state reputation estimate, the sum of {@link AdKind#stateDelta} over successful solves
     */
    public static Optional<Decision> decide(Stats stats, List<Ad> board, List<ShopItem> shop,
                                            Map<String, Integer> purchases, int stateEstimate) {
        List<Ad> playable = playable(board, stateEstimate);
        boolean anyPlayable = !playable.isEmpty();
        boolean anySafe = playable.stream().anyMatch(ad -> Risk.riskTier(ad) == Risk.Tier.SAFE);
        boolean allDeadly = anyPlayable && playable.stream().allMatch(ad -> Risk.riskTier(ad) == Risk.Tier.DEADLY);
        int gold = stats.gold();
        int lives = stats.lives();
        Optional<ShopItem> potion = shelfOrder(shop).stream().filter(item -> item.livesGained() > 0).findFirst();

        // 3. Heal only at 1 life.
        if (lives == 1 && potion.isPresent() && potion.get().affordable(gold)) {
            return buy(potion.get());
        }
        // 4. At 2 lives with no safe ad, a level beats a potion.
        if (lives == 2 && anyPlayable && !anySafe) {
            Optional<Decision> level = levelItem(shop, purchases, gold, GOLD_TWO_LIVES_PLUS2);
            if (level.isPresent()) {
                return level;
            }
        }
        // 5. Proactive +2 while some playable ad is not safe.
        if (lives >= 2 && gold >= GOLD_PROACTIVE_PLUS2 && playable.stream().anyMatch(ad -> Risk.riskTier(ad) != Risk.Tier.SAFE)) {
            Optional<ShopItem> item = leastBought(shop, purchases, 2, gold);
            if (item.isPresent()) {
                return buy(item.get());
            }
        }
        // 6. All deadly: level up rather than gamble, keeping 50 for a potion.
        if (allDeadly && lives >= 2) {
            Optional<Decision> level = levelItem(shop, purchases, gold, GOLD_DEADLY_PLUS2);
            if (level.isPresent()) {
                return level;
            }
        }
        if (!anyPlayable) {
            return Optional.empty();
        }
        // 7. Broke: play safe until a potion is affordable.
        if (potion.isPresent() && gold < potion.get().cost()) {
            return Optional.of(new Decision.Solve(playable.stream().min(SAFEST).orElseThrow()));
        }
        // 7b. Best value, where a loss costs LOSS_BASE plus a turn (valued at the best safe reward).
        int lossCost = LOSS_BASE + playable.stream()
                .filter(ad -> Risk.riskTier(ad) == Risk.Tier.SAFE)
                .mapToInt(Ad::reward).max().orElse(0);
        Comparator<Ad> byValue = Comparator.comparingLong((Ad ad) -> value(ad, lossCost)).reversed()
                .thenComparing(Comparator.comparingInt((Ad ad) -> Risk.winPct(ad)).reversed())
                .thenComparingInt(Ad::expiresIn)
                .thenComparing(Ad::adId);
        return Optional.of(new Decision.Solve(playable.stream().min(byValue).orElseThrow()));
    }

    /** {@code winPct × reward − (100 − winPct) × lossCost}, integer maths. */
    static long value(Ad ad, int lossCost) {
        int pct = Risk.winPct(ad);
        return (long) pct * ad.reward() - (long) (100 - pct) * lossCost;
    }

    /** Steps 1–2: solvable ads without bait, and without steals when the guard is on and anything else is left. */
    static List<Ad> playable(List<Ad> board, int stateEstimate) {
        boolean baitOnBoard = board.stream().anyMatch(AdKind::isBait);
        List<Ad> candidates = board.stream().filter(Ad::solvable).filter(ad -> !AdKind.isBait(ad)).toList();
        boolean guard = baitOnBoard || stateEstimate + AdKind.STEAL_STATE_DELTA < STATE_FLOOR;
        if (!guard) {
            return candidates;
        }
        List<Ad> noSteals = candidates.stream().filter(ad -> !AdKind.isSteal(ad)).toList();
        return noSteals.isEmpty() ? candidates : noSteals;
    }

    /**
     * At {@code plus2Gold}+ gold the least-bought +2 item. Never a +1: it eases about 3% of ads for a
     * whole turn, and every losing probe game bought 7–22 of them [V] (strategy-findings.md, "Loss penalty
     * and +1 items").
     */
    private static Optional<Decision> levelItem(List<ShopItem> shop, Map<String, Integer> purchases, int gold,
                                                int plus2Gold) {
        if (gold < plus2Gold) {
            return Optional.empty();
        }
        return leastBought(shop, purchases, 2, gold).map(Decision.Buy::new);
    }

    /** The affordable item granting {@code levels} levels bought least often; ties keep shop (API) order. */
    static Optional<ShopItem> leastBought(List<ShopItem> shop, Map<String, Integer> purchases, int levels, int gold) {
        return shop.stream()
                .filter(item -> item.levelsGained() == levels && item.affordable(gold))
                .min(Comparator.comparingInt(item -> purchases.getOrDefault(item.id(), 0)));
    }

    private static Optional<Decision> buy(ShopItem item) {
        return Optional.of(new Decision.Buy(item));
    }

    /** Safe 1 … deadly 4; unknown after every known tier. */
    private static int tierRank(Ad ad) {
        Integer level = Risk.riskLevel(ad);
        return level == null ? 5 : level;
    }
}
