package io.github.kevternal.dragonsofmugloar.npc.game;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * One game's state, without I/O: stats, the shop, successful purchases per item, the state reputation
 * estimate (no reputation calls), and the ads and items found gone.
 */
public final class GameState {

    private final String id;
    /** Items found gone are removed from it. */
    private final List<ShopItem> shop = new ArrayList<>();
    private final Map<String, Integer> purchases = new HashMap<>();
    private final Set<String> deadAdIds = new HashSet<>();
    private Stats stats;
    private int stateEstimate;

    public GameState(String id, Stats stats) {
        this.id = id;
        this.stats = stats;
    }

    public String id() {
        return id;
    }

    public Stats stats() {
        return stats;
    }

    public int stateEstimate() {
        return stateEstimate;
    }

    /** Adds the shop's items. */
    public void stock(List<ShopItem> items) {
        shop.addAll(items);
    }

    /** The board without the ads known to be gone. */
    public List<Ad> live(List<Ad> board) {
        return board.stream().filter(ad -> !deadAdIds.contains(ad.adId())).toList();
    }

    public Optional<Decision> decide(List<Ad> board) {
        return Strategy.decide(stats, board, shop, purchases, stateEstimate);
    }

    /** Applies a solve: a success moves the state estimate; the stats become {@code after}. */
    public TurnRecord solved(Ad ad, boolean success, Stats after, String flavour) {
        if (success) {
            stateEstimate += AdKind.stateDelta(ad.message());
        }

        String action = ad.message() + " (" + ad.probability() + ", " + ad.reward() + ")";
        return apply(new TurnRecord(TurnRecord.Kind.SOLVE, success, action, flavour, stats, after));
    }

    /** Applies a buy: a success counts the purchase; the stats become {@code after}. */
    public TurnRecord bought(ShopItem item, boolean success, Stats after) {
        if (success) {
            purchases.merge(item.id(), 1, Integer::sum);
        }

        return apply(new TurnRecord(TurnRecord.Kind.BUY, success, item.name(), null, stats, after));
    }

    /** Remembers that the decision's ad or item is gone. */
    public void forget(Decision decision) {
        switch (decision) {
            case Decision.Solve solve -> deadAdIds.add(solve.ad().adId());
            case Decision.Buy buy -> shop.remove(buy.item());
        }
    }

    private TurnRecord apply(TurnRecord record) {
        stats = record.after();
        return record;
    }
}
