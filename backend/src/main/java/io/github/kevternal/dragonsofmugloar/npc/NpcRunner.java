package io.github.kevternal.dragonsofmugloar.npc;

import java.util.List;
import java.util.Optional;

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
import io.github.kevternal.dragonsofmugloar.npc.game.Decision;
import io.github.kevternal.dragonsofmugloar.npc.game.ShopItem;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.Strategy;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/**
 * Plays one game on startup: start, shop, then per turn wait while paused → messages → decide → act
 * → merge stats → log. There is no request budget; the game plays until it ends.
 */
@Component
@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")
public class NpcRunner implements ApplicationRunner {

    private final MugloarClient client;
    private final Terminal terminal;
    private final PauseControl pause;
    private Stats stats;

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
            List<ShopItem> shop = client.shop(gameId).stream()
                    .map(dto -> new ShopItem(dto.id(), dto.name(), dto.cost()))
                    .toList();
            while (true) {
                // lives 0 is game over [V]; a finished game's messages return 404, so don't refetch.
                if (stats.lives() <= 0) {
                    return "game over";
                }
                // A pause takes effect here, between turns: the last action has finished and been logged.
                pause.awaitRunning();
                List<Ad> board = client.messages(gameId).stream().map(NpcRunner::decode).toList();
                Optional<Decision> decision = Strategy.decide(stats, board, shop);
                if (decision.isEmpty()) {
                    return "no playable move";
                }
                // Enter may arrive while messages is in flight; ads expire by turns, not time [D], so
                // the fetched board stays valid across the pause, and no solve or buy goes out meanwhile.
                pause.awaitRunning();
                TurnRecord record = switch (decision.get()) {
                    case Decision.Solve solve -> solve(gameId, solve.ad());
                    case Decision.Buy buy -> buy(gameId, buy.item());
                };
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

    private TurnRecord solve(String gameId, Ad ad) {
        SolveDto result = client.solve(gameId, ad.adId());
        Stats after = stats.merge(result.lives(), result.gold(), null, result.score(), result.turn());
        String action = ad.message() + " (" + ad.probability() + ", " + ad.reward() + ")";
        return new TurnRecord(TurnRecord.Kind.SOLVE, result.success(), action, result.message(), stats, after);
    }

    private TurnRecord buy(String gameId, ShopItem item) {
        BuyDto result = client.buy(gameId, item.id());
        Stats after = stats.merge(result.lives(), result.gold(), result.level(), null, result.turn());
        return new TurnRecord(TurnRecord.Kind.BUY, result.shoppingSuccess(), item.name(), null, stats, after);
    }

    private static Ad decode(AdDto dto) {
        return AdDecoder.decode(dto.adId(), dto.message(), dto.probability(), dto.reward(), dto.expiresIn(),
                dto.encrypted());
    }
}
