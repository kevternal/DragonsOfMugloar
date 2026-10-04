package io.github.kevternal.dragonsofmugloar.npc;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import io.github.kevternal.dragonsofmugloar.npc.api.AdDto;
import io.github.kevternal.dragonsofmugloar.npc.api.BuyDto;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarApiException;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.api.SolveDto;
import io.github.kevternal.dragonsofmugloar.npc.api.StartDto;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;
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
 * Plays one game on startup: start, shop, then per turn wait while paused → messages → decide → act
 * → merge stats → log. There is no request budget; the game plays until it ends.
 *
 * <p>Owns the game's state: stats, successful purchases per item, the state reputation estimate
 * (no reputation calls), and the ads and items found gone. A 404 on solve or buy means the ad or item
 * is gone: it is remembered, the board is read once more, and the tree decides again on that board.
 */
@Component
@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")
public class NpcRunner implements ApplicationRunner {

    private final MugloarClient client;
    private final Terminal terminal;
    private final PauseControl pause;
    private Stats stats;
    private final Map<String, Integer> purchases = new HashMap<>();
    private int stateEstimate;
    private final Set<String> deadAdIds = new HashSet<>();

    @Autowired
    public NpcRunner() {
        this(MugloarClient.create(), new Terminal(), new PauseControl(System.in));
    }

    NpcRunner(MugloarClient client, Terminal terminal, PauseControl pause) {
        this.client = client;
        this.terminal = terminal;
        this.pause = pause;
    }

    @Override
    public void run(ApplicationArguments args) {
        terminal.summary(play(), stats, client.used());
    }

    /** Plays until the game ends or cannot go on, and returns the summary reason. */
    String play() {
        pause.start(terminal);
        try {
            StartDto start = client.start();
            String gameId = start.gameId();
            // Level is tracked from start and buy responses only; solving doesn't change it [V].
            stats = new Stats(start.lives(), start.gold(), start.level(), start.score(), start.turn());
            terminal.status(stats);
            terminal.startHistory(gameId);
            List<ShopItem> shop = new ArrayList<>(client.shop(gameId).stream()
                    .map(dto -> new ShopItem(dto.id(), dto.name(), dto.cost()))
                    .toList());
            // Non-null after a 404 on solve or buy: the re-read board to decide on, instead of a fresh read.
            List<Ad> reread = null;
            while (true) {
                // lives 0 is game over [V]; a finished game's messages return 404, so don't refetch.
                if (stats.lives() <= 0) {
                    return "game over";
                }
                // A pause takes effect here, between turns: the last action has finished and been logged.
                pause.awaitRunning();
                // A 404 on this regular read still ends the game as expired (via the catch below).
                List<Ad> board = reread != null ? reread : readBoard(gameId);
                boolean afterGone = reread != null;
                reread = null;
                Optional<Decision> decision = Strategy.decide(stats, board, shop, purchases, stateEstimate);
                if (decision.isEmpty()) {
                    return afterGone ? BOARD_UNAVAILABLE : "no playable move";
                }
                // Enter may arrive while messages is in flight; ads expire by turns, not time [D], so
                // the fetched board stays valid across the pause, and no solve or buy goes out meanwhile.
                pause.awaitRunning();
                TurnRecord record;
                try {
                    record = switch (decision.get()) {
                        case Decision.Solve solve -> solve(gameId, solve.ad());
                        case Decision.Buy buy -> buy(gameId, buy.item());
                    };
                } catch (MugloarApiException e) {
                    if (!isGone(e)) {
                        throw e;
                    }
                    // Never retried: remember what is gone and decide again on a fresh board.
                    switch (decision.get()) {
                        case Decision.Solve solve -> deadAdIds.add(solve.ad().adId());
                        case Decision.Buy buy -> shop.remove(buy.item());
                    }
                    try {
                        reread = readBoard(gameId);
                    } catch (MugloarApiException readError) {
                        if (readError.kind() == MugloarApiException.Kind.EXPIRED) {
                            return BOARD_UNAVAILABLE;
                        }
                        throw readError;
                    }
                    continue;
                }
                stats = record.after();
                terminal.log(record);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "interrupted";
        } catch (MugloarApiException e) {
            return e.kind() == MugloarApiException.Kind.EXPIRED
                    ? "game expired"
                    : "error: " + e.kind() + (e.status() != null ? " " + e.status() : "") + " (" + e.getMessage() + ")";
        } catch (RuntimeException e) {
            return "error: " + e;
        }
    }

    static final String BOARD_UNAVAILABLE = "board unavailable";

    /** Reads and decodes the board, logs any bait on it, and drops the ads known to be gone. */
    private List<Ad> readBoard(String gameId) {
        List<Ad> board = client.messages(gameId).stream().map(NpcRunner::decode).toList();
        long bait = AdKind.baitCount(board);
        if (bait > 0) {
            terminal.bait(bait, stateEstimate);
        }
        return board.stream().filter(ad -> !deadAdIds.contains(ad.adId())).toList();
    }

    /** A 404 on solve or buy: the ad or item is gone. */
    private static boolean isGone(MugloarApiException e) {
        return e.kind() == MugloarApiException.Kind.HTTP && e.status() != null && e.status() == 404;
    }

    private TurnRecord solve(String gameId, Ad ad) {
        SolveDto result = client.solve(gameId, ad.adId());
        if (result.success()) {
            stateEstimate += AdKind.stateDelta(ad.message());
        }
        Stats after = stats.merge(result.lives(), result.gold(), null, result.score(), result.turn());
        String action = ad.message() + " (" + ad.probability() + ", " + ad.reward() + ")";
        return new TurnRecord(TurnRecord.Kind.SOLVE, result.success(), action, result.message(), stats, after);
    }

    private TurnRecord buy(String gameId, ShopItem item) {
        BuyDto result = client.buy(gameId, item.id());
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
