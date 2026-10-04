package io.github.kevternal.dragonsofmugloar.npc;

import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import io.github.kevternal.dragonsofmugloar.npc.api.AdDto;
import io.github.kevternal.dragonsofmugloar.npc.api.BudgetExhaustedException;
import io.github.kevternal.dragonsofmugloar.npc.api.BuyDto;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarApiException;
import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.api.SolveDto;
import io.github.kevternal.dragonsofmugloar.npc.api.StartDto;
import io.github.kevternal.dragonsofmugloar.npc.console.Terminal;
import io.github.kevternal.dragonsofmugloar.npc.game.Ad;
import io.github.kevternal.dragonsofmugloar.npc.game.AdDecoder;
import io.github.kevternal.dragonsofmugloar.npc.game.Decision;
import io.github.kevternal.dragonsofmugloar.npc.game.ShopItem;
import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.Strategy;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

/** Plays one game on startup: start, shop, then messages → decide → act → merge stats → log. */
@Component
@ConditionalOnProperty(name = "npc.enabled", havingValue = "true")
public class NpcRunner implements ApplicationRunner {

    /** Requests granted at each budget checkpoint after the first 300. */
    static final int GRANT = 100;

    private final MugloarClient client;
    private final Terminal terminal;
    private Stats stats;

    @Autowired
    public NpcRunner() {
        this(MugloarClient.create(), new Terminal());
    }

    NpcRunner(MugloarClient client, Terminal terminal) {
        this.client = client;
        this.terminal = terminal;
    }

    @Override
    public void run(ApplicationArguments args) {
        terminal.summary(play(), stats, client.used());
    }

    /** Plays until the game ends or cannot go on, and returns the summary reason. */
    String play() {
        try {
            StartDto start = step(client::start);
            String gameId = start.gameId();
            // Level is tracked from start and buy responses only; solving doesn't change it [V].
            stats = new Stats(start.lives(), start.gold(), start.level(), start.score(), start.turn());
            List<ShopItem> shop = step(() -> client.shop(gameId)).stream()
                    .map(dto -> new ShopItem(dto.id(), dto.name(), dto.cost()))
                    .toList();
            while (true) {
                // lives 0 is game over [V]; a finished game's messages return 404, so don't refetch.
                if (stats.lives() <= 0) {
                    return "game over";
                }
                List<Ad> board = step(() -> client.messages(gameId)).stream().map(NpcRunner::decode).toList();
                Optional<Decision> decision = Strategy.decide(stats, board, shop);
                if (decision.isEmpty()) {
                    return "no playable move";
                }
                TurnRecord record = switch (decision.get()) {
                    case Decision.Solve solve -> solve(gameId, solve.ad());
                    case Decision.Buy buy -> buy(gameId, buy.item());
                };
                stats = record.after();
                terminal.log(record);
            }
        } catch (BudgetExhaustedException e) {
            return "budget exhausted";
        } catch (MugloarApiException e) {
            return e.kind() == MugloarApiException.Kind.EXPIRED
                    ? "game expired"
                    : "error: " + e.kind() + (e.status() != null ? " " + e.status() : "") + " (" + e.getMessage() + ")";
        } catch (RuntimeException e) {
            return "error: " + e;
        }
    }

    private TurnRecord solve(String gameId, Ad ad) {
        SolveDto result = step(() -> client.solve(gameId, ad.adId()));
        Stats after = stats.merge(result.lives(), result.gold(), null, result.score(), result.turn());
        String action = ad.message() + " (" + ad.probability() + ", " + ad.reward() + ")";
        return new TurnRecord(TurnRecord.Kind.SOLVE, result.success(), action, result.message(), stats, after);
    }

    private TurnRecord buy(String gameId, ShopItem item) {
        BuyDto result = step(() -> client.buy(gameId, item.id()));
        Stats after = stats.merge(result.lives(), result.gold(), result.level(), null, result.turn());
        return new TurnRecord(TurnRecord.Kind.BUY, result.shoppingSuccess(), item.name(), null, stats, after);
    }

    /**
     * Runs one client call. At a budget checkpoint nothing was sent, so on "y" the same call
     * re-runs and no turn is lost or doubled; a decline propagates and ends the run.
     */
    private <T> T step(Supplier<T> call) {
        while (true) {
            try {
                return call.get();
            } catch (BudgetExhaustedException e) {
                if (!terminal.confirmMore(client.used(), GRANT)) {
                    throw e;
                }
                client.grant(GRANT);
            }
        }
    }

    private static Ad decode(AdDto dto) {
        return AdDecoder.decode(dto.adId(), dto.message(), dto.probability(), dto.reward(), dto.expiresIn(),
                dto.encrypted());
    }
}
