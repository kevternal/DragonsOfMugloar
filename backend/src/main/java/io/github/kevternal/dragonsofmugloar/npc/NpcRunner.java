package io.github.kevternal.dragonsofmugloar.npc;

import java.util.List;
import java.util.Optional;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import io.github.kevternal.dragonsofmugloar.npc.api.MugloarApiException;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;
import io.github.kevternal.dragonsofmugloar.npc.console.Terminal;
import io.github.kevternal.dragonsofmugloar.npc.game.Ad;
import io.github.kevternal.dragonsofmugloar.npc.game.Decision;

/**
 * Plays one {@link Game} on startup: start, shop, then per turn wait while paused → messages → decide
 * → act → merge stats → log. There is no request budget; the game plays until it ends.
 *
 * <p>A 404 on solve or buy means the ad or item is gone: it is remembered, the board is read once
 * more, and the tree decides again on that board.
 */
@Component
@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")
public class NpcRunner implements ApplicationRunner {

    static final String GAME_OVER = "game over";
    static final String NO_PLAYABLE_MOVE = "no playable move";
    static final String BOARD_UNAVAILABLE = "board unavailable";

    private final MugloarClient client;
    private final Terminal terminal;
    private final PauseControl pause;
    /** Null until the game has started. */
    private Game game;

    public NpcRunner(MugloarClient client, Terminal terminal, PauseControl pause) {
        this.client = client;
        this.terminal = terminal;
        this.pause = pause;
    }

    @Override
    public void run(ApplicationArguments args) {
        String reason = play();
        terminal.summary(reason, game == null ? null : game.stats(), client.used());
    }

    /** Plays until the game ends or cannot go on, and returns the summary reason. */
    String play() {
        pause.start(terminal);
        try {
            game = Game.start(client, terminal);
            game.readShop();
            return playTurns();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "interrupted";
        } catch (MugloarApiException e) {
            return describe(e);
        } catch (RuntimeException e) {
            return "error: " + e;
        }
    }

    private String playTurns() throws InterruptedException {
        // Non-null after a 404 on solve or buy: the re-read board to decide on, instead of a fresh read.
        List<Ad> reread = null;
        // lives 0 is game over [V]; a finished game's messages return 404, so don't refetch.
        while (game.stats().lives() > 0) {
            // A pause takes effect here, between turns: the last action has finished and been logged.
            pause.awaitRunning();
            // A 404 on this regular read still ends the game as expired (via the catch in play).
            List<Ad> board = reread != null ? reread : game.readBoard();
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
                game.play(decision.get());
            } catch (MugloarApiException e) {
                if (!isGone(e)) {
                    throw e;
                }

                // Never retried: remember what is gone and decide again on a fresh board.
                game.forget(decision.get());
                Optional<List<Ad>> fresh = rereadBoard();
                if (fresh.isEmpty()) {
                    return BOARD_UNAVAILABLE;
                }

                reread = fresh.get();
            }
        }

        return GAME_OVER;
    }

    /** The board after a gone ad or item; empty when the game has expired meanwhile. */
    private Optional<List<Ad>> rereadBoard() {
        try {
            return Optional.of(game.readBoard());
        } catch (MugloarApiException e) {
            if (e.kind() == MugloarApiException.Kind.EXPIRED) {
                return Optional.empty();
            }

            throw e;
        }
    }

    /** A 404 on solve or buy: the ad or item is gone. */
    private static boolean isGone(MugloarApiException e) {
        return e.kind() == MugloarApiException.Kind.HTTP && e.status() != null && e.status() == 404;
    }

    private static String describe(MugloarApiException e) {
        if (e.kind() == MugloarApiException.Kind.EXPIRED) {
            return "game expired";
        }

        String status = e.status() != null ? " " + e.status() : "";
        return "error: " + e.kind() + status + " (" + e.getMessage() + ")";
    }
}
