package io.github.kevternal.dragonsofmugloar.npc;

import java.util.List;
import java.util.Optional;

import io.github.kevternal.dragonsofmugloar.npc.api.AdDto;
import io.github.kevternal.dragonsofmugloar.npc.api.BuyDto;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarApiException;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.api.SolveDto;
import io.github.kevternal.dragonsofmugloar.npc.api.StartDto;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;
import io.github.kevternal.dragonsofmugloar.npc.game.Ad;
import io.github.kevternal.dragonsofmugloar.npc.game.AdDecoder;
import io.github.kevternal.dragonsofmugloar.npc.game.AdKind;
import io.github.kevternal.dragonsofmugloar.npc.game.Decision;
import io.github.kevternal.dragonsofmugloar.npc.game.GameEvents;
import io.github.kevternal.dragonsofmugloar.npc.game.GameState;
import io.github.kevternal.dragonsofmugloar.npc.game.ShopItem;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * Plays one game: start, shop, then per turn wait while paused → messages → decide → act → merge
 * stats → report. There is no request budget; the game plays until it ends. Maps the API's DTOs onto
 * the {@link GameState} and reports to every {@link GameEvents}, in list order.
 *
 * <p>A 404 on solve or buy means the ad or item is gone: it is remembered, the board is read once
 * more, and the tree decides again on that board.
 */
public class GamePlayer {

    static final String GAME_OVER = "game over";
    static final String NO_PLAYABLE_MOVE = "no playable move";
    static final String BOARD_UNAVAILABLE = "board unavailable";

    /** How the run ended; {@code stats} is null when the game never started. */
    public record RunResult(String reason, Stats stats) {
    }

    private final MugloarClient client;
    private final PauseControl pause;
    private final List<GameEvents> events;

    public GamePlayer(MugloarClient client, PauseControl pause, List<GameEvents> events) {
        this.client = client;
        this.pause = pause;
        this.events = List.copyOf(events);
    }

    /** Starts the pause reader, plays until the game ends or cannot go on, then reports the end. */
    public RunResult play() {
        pause.start();
        GameState game = null;
        String reason;
        try {
            game = start();
            readShop(game);
            reason = playTurns(game);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            reason = "interrupted";
        } catch (MugloarApiException e) {
            reason = describe(e);
        } catch (RuntimeException e) {
            reason = "error: " + e;
        }

        RunResult result = new RunResult(reason, game == null ? null : game.stats());
        int used = client.used();
        events.forEach(e -> e.ended(result.reason(), result.stats(), used));
        return result;
    }

    /** Starts a game; its shop is read separately, so a failed read still leaves the start stats. */
    private GameState start() {
        StartDto start = client.start();
        // Level is tracked from start and buy responses only; solving doesn't change it [V].
        Stats stats = new Stats(start.lives(), start.gold(), start.level(), start.score(), start.turn());
        GameState game = new GameState(start.gameId(), stats);
        events.forEach(e -> e.started(start.gameId(), stats));
        return game;
    }

    private void readShop(GameState game) {
        game.stock(client.shop(game.id()).stream().map(dto -> new ShopItem(dto.id(), dto.name(), dto.cost())).toList());
    }

    private String playTurns(GameState game) throws InterruptedException {
        // Non-null after a 404 on solve or buy: the re-read board to decide on, instead of a fresh read.
        List<Ad> reread = null;
        // lives 0 is game over [V]; a finished game's messages return 404, so don't refetch.
        while (game.stats().lives() > 0) {
            // A pause takes effect here, between turns: the last action has finished and been logged.
            pause.awaitRunning();
            // A 404 on this regular read still ends the game as expired (via the catch in play).
            List<Ad> board = reread != null ? reread : readBoard(game);
            boolean afterGone = reread != null;
            reread = null;
            Optional<Decision> decision = game.decide(board);
            if (decision.isEmpty()) {
                return afterGone ? BOARD_UNAVAILABLE : NO_PLAYABLE_MOVE;
            }

            // Enter may arrive while messages is in flight; ads expire by turns, not time [D], so
            // the fetched board stays valid across the pause, and no solve or buy goes out meanwhile.
            pause.awaitRunning();
            try {
                TurnRecord record = take(game, decision.get());
                events.forEach(e -> e.turn(record));
            } catch (MugloarApiException e) {
                if (e.kind() != MugloarApiException.Kind.GONE) {
                    throw e;
                }

                // Never retried: remember what is gone and decide again on a fresh board.
                game.forget(decision.get());
                Optional<List<Ad>> fresh = rereadBoard(game);
                if (fresh.isEmpty()) {
                    return BOARD_UNAVAILABLE;
                }

                reread = fresh.get();
            }
        }

        return GAME_OVER;
    }

    /** Takes the turn and applies its result to the game. */
    private TurnRecord take(GameState game, Decision decision) {
        return switch (decision) {
            case Decision.Solve solve -> {
                SolveDto result = client.solve(game.id(), solve.ad().adId());
                Stats after = game.stats().merge(result.lives(), result.gold(), null, result.score(), result.turn());
                yield game.solved(solve.ad(), result.success(), after, result.message());
            }
            case Decision.Buy buy -> {
                BuyDto result = client.buy(game.id(), buy.item().id());
                Stats after = game.stats().merge(result.lives(), result.gold(), result.level(), null, result.turn());
                yield game.bought(buy.item(), result.shoppingSuccess(), after);
            }
        };
    }

    /** Reads and decodes the board, reports any bait on it, and drops the ads known to be gone. */
    private List<Ad> readBoard(GameState game) {
        List<Ad> board = client.messages(game.id()).stream().map(GamePlayer::decode).toList();
        long bait = AdKind.baitCount(board);
        if (bait > 0) {
            int estimate = game.stateEstimate();
            events.forEach(e -> e.bait(bait, estimate));
        }

        return game.live(board);
    }

    /** The board after a gone ad or item; empty when the game has expired meanwhile. */
    private Optional<List<Ad>> rereadBoard(GameState game) {
        try {
            return Optional.of(readBoard(game));
        } catch (MugloarApiException e) {
            if (e.kind() == MugloarApiException.Kind.EXPIRED) {
                return Optional.empty();
            }

            throw e;
        }
    }

    private static String describe(MugloarApiException e) {
        if (e.kind() == MugloarApiException.Kind.EXPIRED) {
            return "game expired";
        }

        String status = e.status() != null ? " " + e.status() : "";
        return "error: " + e.kind() + status + " (" + e.getMessage() + ")";
    }

    private static Ad decode(AdDto dto) {
        return AdDecoder.decode(dto.adId(), dto.message(), dto.probability(), dto.reward(), dto.expiresIn(),
                dto.encrypted());
    }
}
