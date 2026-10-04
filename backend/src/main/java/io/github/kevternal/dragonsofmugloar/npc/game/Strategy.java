package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/** The NPC's decision rule, as pure functions. Sorting is ported from AD-4 {@code sortJobs}. */
public final class Strategy {

    /** The two sorts of strategies.md. */
    public enum SortMode { PLAY_IT_SAFE, FOR_GLORY }

    /** Lives above this sort the For Glory! way and buy the level item with the most levels. */
    static final int CAREFUL_LIVES = 2;
    /** A board where every measured ad is at this risk level or higher is "hard". */
    static final int HARD_RISK_LEVEL = 3;

    private static final Comparator<Ad> REWARD_THEN_EXPIRY =
            Comparator.comparing((Ad ad) -> Risk.expectedReward(ad), Comparator.reverseOrder())
                    .thenComparingInt(Ad::expiresIn);

    private static final Comparator<Ad> PLAY_IT_SAFE =
            Comparator.comparing((Ad ad) -> Risk.riskLevel(ad)).thenComparing(REWARD_THEN_EXPIRY)
                    .thenComparing(Ad::adId);

    private static final Comparator<Ad> FOR_GLORY =
            Comparator.comparing((Ad ad) -> Risk.riskLevel(ad) == 4).thenComparing(REWARD_THEN_EXPIRY)
                    .thenComparing(Ad::adId);

    private static final Comparator<Ad> UNKNOWN_RISK =
            Comparator.comparingInt(Ad::reward).reversed().thenComparingInt(Ad::expiresIn)
                    .thenComparing(Ad::adId);

    private Strategy() {
    }

    /**
     * Returns a new list; never filters. Measured ads come first, sorted by the mode's keys then
     * {@code adId}. Unknown-risk ads come after every measured ad, deadly included, by reward
     * descending, {@code expiresIn} ascending, then {@code adId}.
     */
    public static List<Ad> sortJobs(List<Ad> board, SortMode mode) {
        List<Ad> measured = new ArrayList<>();
        List<Ad> unknown = new ArrayList<>();
        for (Ad ad : board) {
            (Risk.riskLevel(ad) == null ? unknown : measured).add(ad);
        }
        measured.sort(mode == SortMode.PLAY_IT_SAFE ? PLAY_IT_SAFE : FOR_GLORY);
        unknown.sort(UNKNOWN_RISK);
        measured.addAll(unknown);
        return measured;
    }

    /** Cost ascending, then API response order (the sort is stable). */
    public static List<ShopItem> shelfOrder(List<ShopItem> items) {
        List<ShopItem> sorted = new ArrayList<>(items);
        sorted.sort(Comparator.comparingInt(ShopItem::cost));
        return sorted;
    }

    /**
     * The decision rule; the first match wins:
     * <ol>
     *   <li>At 1 life with the life item affordable, buy it, even before a safe ad.</li>
     *   <li>At 2 lives with no safe ad and the life item affordable, buy it.</li>
     *   <li>When every measured ad is risk 3 or higher (win rate 40% or lower) and a level item is
     *       affordable, buy one: while lives are above 2, the one with the most levels (ties: cheaper,
     *       then shop order); otherwise the cheapest.</li>
     *   <li>Otherwise solve the top solvable ad: For Glory! while lives are above 2, else Play it safe.</li>
     *   <li>With no solvable ad, there is no playable move: empty.</li>
     * </ol>
     */
    public static Optional<Decision> decide(Stats stats, List<Ad> board, List<ShopItem> shop) {
        List<ShopItem> shelf = shelfOrder(shop);
        Optional<ShopItem> lifeItem = shelf.stream()
                .filter(item -> item.livesGained() > 0 && item.affordable(stats.gold()))
                .findFirst();
        boolean safeAdOnBoard = board.stream().anyMatch(ad -> Risk.riskTier(ad) == Risk.Tier.SAFE);

        if (lifeItem.isPresent() && (stats.lives() == 1 || (stats.lives() == 2 && !safeAdOnBoard))) {
            return Optional.of(new Decision.Buy(lifeItem.get()));
        }

        List<Integer> measuredLevels = board.stream().map(Risk::riskLevel).filter(level -> level != null).toList();
        boolean hardBoard = !measuredLevels.isEmpty()
                && measuredLevels.stream().allMatch(level -> level >= HARD_RISK_LEVEL);
        if (hardBoard) {
            // The shelf is already cost-then-API order, and the sort is stable, so ties keep it.
            Comparator<ShopItem> pick = stats.lives() > CAREFUL_LIVES
                    ? Comparator.comparingInt(ShopItem::levelsGained).reversed()
                    : (a, b) -> 0;
            Optional<ShopItem> levelItem = shelf.stream()
                    .filter(item -> item.levelsGained() > 0 && item.affordable(stats.gold()))
                    .sorted(pick)
                    .findFirst();
            if (levelItem.isPresent()) {
                return Optional.of(new Decision.Buy(levelItem.get()));
            }
        }

        SortMode mode = stats.lives() > CAREFUL_LIVES ? SortMode.FOR_GLORY : SortMode.PLAY_IT_SAFE;
        return sortJobs(board, mode).stream()
                .filter(Ad::solvable)
                .findFirst()
                .map(Decision.Solve::new);
    }
}
