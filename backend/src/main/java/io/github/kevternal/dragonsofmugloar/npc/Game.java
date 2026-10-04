package io.github.kevternal.dragonsofmugloar.npc;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import io.github.kevternal.dragonsofmugloar.npc.api.AdDto;
import io.github.kevternal.dragonsofmugloar.npc.api.BuyDto;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.api.SolveDto;
import io.github.kevternal.dragonsofmugloar.npc.api.StartDto;
import io.github.kevternal.dragonsofmugloar.npc.console.Terminal;
import io.github.kevternal.dragonsofmugloar.npc.game.Ad;
import io.github.kevternal.dragonsofmugloar.npc.game.AdDecoder;
import io.github.kevternal.dragonsofmugloar.npc.game.AdKind;
import io.github.kevternal.dragonsofmugloar.npc.game.Decision;
import io.github.kevternal.dragonsofmugloar.npc.game.ShopItem;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.Strategy;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * One game's state and moves: stats, the shop, successful purchases per item, the state reputation
 * estimate (no reputation calls), and the ads and items found gone.
 */
class Game {

    private final MugloarClient client;
    private final Terminal terminal;
    private final String id;
    /** Items found gone are removed from it. */
    private final List<ShopItem> shop = new ArrayList<>();
    private final Map<String, Integer> purchases = new HashMap<>();
    private final Set<String> deadAdIds = new HashSet<>();
    private Stats stats;
    private int stateEstimate;

    private Game(MugloarClient client, Terminal terminal, String id, Stats stats) {
        this.client = client;
        this.terminal = terminal;
        this.id = id;
        this.stats = stats;
    }

    /** Starts a game; its shop is read separately, so a failed read still leaves the start stats. */
    static Game start(MugloarClient client, Terminal terminal) {
        StartDto start = client.start();
        // Level is tracked from start and buy responses only; solving doesn't change it [V].
        Stats stats = new Stats(start.lives(), start.gold(), start.level(), start.score(), start.turn());
        terminal.status(stats);
        terminal.startHistory(start.gameId());
        return new Game(client, terminal, start.gameId(), stats);
    }

    void readShop() {
        client.shop(id).forEach(dto -> shop.add(new ShopItem(dto.id(), dto.name(), dto.cost())));
    }

    Stats stats() {
        return stats;
    }

    /** Reads and decodes the board, logs any bait on it, and drops the ads known to be gone. */
    List<Ad> readBoard() {
        List<Ad> board = client.messages(id).stream().map(Game::decode).toList();
        long bait = AdKind.baitCount(board);
        if (bait > 0) {
            terminal.bait(bait, stateEstimate);
        }

        return board.stream().filter(ad -> !deadAdIds.contains(ad.adId())).toList();
    }

    Optional<Decision> decide(List<Ad> board) {
        return Strategy.decide(stats, board, shop, purchases, stateEstimate);
    }

    /** Takes the turn, then merges and logs its result. */
    void play(Decision decision) {
        TurnRecord record = switch (decision) {
            case Decision.Solve solve -> solve(solve.ad());
            case Decision.Buy buy -> buy(buy.item());
        };
        stats = record.after();
        terminal.log(record);
    }

    /** Remembers that the decision's ad or item is gone. */
    void forget(Decision decision) {
        switch (decision) {
            case Decision.Solve solve -> deadAdIds.add(solve.ad().adId());
            case Decision.Buy buy -> shop.remove(buy.item());
        }
    }

    private TurnRecord solve(Ad ad) {
        SolveDto result = client.solve(id, ad.adId());
        if (result.success()) {
            stateEstimate += AdKind.stateDelta(ad.message());
        }

        Stats after = stats.merge(result.lives(), result.gold(), null, result.score(), result.turn());
        String action = ad.message() + " (" + ad.probability() + ", " + ad.reward() + ")";
        return new TurnRecord(TurnRecord.Kind.SOLVE, result.success(), action, result.message(), stats, after);
    }

    private TurnRecord buy(ShopItem item) {
        BuyDto result = client.buy(id, item.id());
        if (result.shoppingSuccess()) {
            purchases.merge(item.id(), 1, Integer::sum);
        }

        Stats after = stats.merge(result.lives(), result.gold(), result.level(), null, result.turn());
        return new TurnRecord(TurnRecord.Kind.BUY, result.shoppingSuccess(), item.name(), null, stats, after);
    }

    private static Ad decode(AdDto dto) {
        return AdDecoder.decode(dto.adId(), dto.message(), dto.probability(), dto.reward(), dto.expiresIn(),
                dto.encrypted());
    }
}
