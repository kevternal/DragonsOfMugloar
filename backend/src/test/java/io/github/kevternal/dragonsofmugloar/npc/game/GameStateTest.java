package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class GameStateTest {

    private static final Stats START = new Stats(3, 0, 1, 0, 0);
    private static final Ad STEAL = new Ad("s1", "Steal cows delivery to Ann", 40, 2, "Sure thing", true);
    private static final Ad SLAY = new Ad("a1", "Slay", 40, 2, "Sure thing", true);
    private static final ShopItem POTION = new ShopItem("hpot", "Healing potion", 50);

    private final GameState game = new GameState("g1", START);

    @Test
    void estimateMovesOnlyOnASuccessfulSolve() {
        Stats lost = new Stats(2, 0, 1, 0, 1);
        TurnRecord failed = game.solved(STEAL, false, lost, "You failed");
        assertThat(game.stateEstimate()).isZero();
        assertThat(failed).isEqualTo(new TurnRecord(TurnRecord.Kind.SOLVE, false,
                "Steal cows delivery to Ann (Sure thing, 40)", "You failed", START, lost));
        assertThat(game.stats()).isEqualTo(lost);

        Stats won = new Stats(2, 40, 1, 40, 2);
        game.solved(STEAL, true, won, "ok");
        assertThat(game.stateEstimate()).isEqualTo(-2);
        assertThat(game.stats()).isEqualTo(won);
    }

    @Test
    void buyAppliesItsStatsAndLeavesTheEstimate() {
        Stats after = new Stats(4, 10, 1, 0, 1);
        TurnRecord record = game.bought(POTION, true, after);
        assertThat(record).isEqualTo(new TurnRecord(TurnRecord.Kind.BUY, true, "Healing potion", null, START, after));
        assertThat(game.stats()).isEqualTo(after);
        assertThat(game.stateEstimate()).isZero();
    }

    @Test
    void liveFiltersForgottenAds() {
        assertThat(game.live(List.of(STEAL, SLAY))).containsExactly(STEAL, SLAY);
        game.forget(new Decision.Solve(SLAY));
        assertThat(game.live(List.of(STEAL, SLAY))).containsExactly(STEAL);
    }

    @Test
    void forgetDropsTheItemFromTheShop() {
        GameState lastLife = new GameState("g1", new Stats(1, 60, 1, 0, 0));
        lastLife.stock(List.of(POTION));
        assertThat(lastLife.decide(List.of())).contains(new Decision.Buy(POTION));

        lastLife.forget(new Decision.Buy(POTION));
        assertThat(lastLife.decide(List.of())).isEmpty();
    }
}
