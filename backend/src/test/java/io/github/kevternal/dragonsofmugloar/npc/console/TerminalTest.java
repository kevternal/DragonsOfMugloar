package io.github.kevternal.dragonsofmugloar.npc.console;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import io.github.kevternal.dragonsofmugloar.npc.game.Stats;
import io.github.kevternal.dragonsofmugloar.npc.game.TurnRecord;

class TerminalTest {

    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();

    private Terminal terminal(String input) {
        return new Terminal(new PrintStream(bytes, true, StandardCharsets.UTF_8),
                new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8)));
    }

    private String output() {
        return bytes.toString(StandardCharsets.UTF_8);
    }

    @Test
    void solveAndBuyLinesMatchThePlanExample() {
        Terminal terminal = terminal("");
        terminal.log(new TurnRecord(TurnRecord.Kind.SOLVE, true, "Help defend the village (Piece of cake, 82)",
                "You successfully solved the mission!", new Stats(3, 129, 4, 818, 11), new Stats(3, 211, 4, 900, 12)));
        terminal.log(new TurnRecord(TurnRecord.Kind.BUY, true, "Healing potion", null,
                new Stats(2, 211, 4, 900, 12), new Stats(3, 161, 4, 900, 13)));
        assertThat(output()).isEqualTo("""
                T12  ✓ Solve  Help defend the village (Piece of cake, 82)  +82 gold        | lives 3 | level 4 | gold 211 | score 900 | turn 12
                       You successfully solved the mission!
                T13  ✓ Buy    Healing potion                               −50 gold, +1 life | lives 3 | level 4 | gold 161 | score 900 | turn 13
                """);
    }

    @Test
    void failedSolveShowsCrossAndLifeLoss() {
        String line = Terminal.formatLine(new TurnRecord(TurnRecord.Kind.SOLVE, false, "Steal (Gamble, 40)",
                "You failed on the mission!", new Stats(3, 10, 0, 0, 1), new Stats(1, 10, 0, 0, 2)));
        assertThat(line).startsWith("T2   ✗ Solve  Steal (Gamble, 40)").contains("  −2 lives ").endsWith("| lives 1 | level 0 | gold 10 | score 0 | turn 2");
    }

    @Test
    void zeroDeltasAreLeftOut() {
        String line = Terminal.formatLine(new TurnRecord(TurnRecord.Kind.BUY, false, "Gasoline", null,
                new Stats(3, 10, 0, 0, 1), new Stats(3, 10, 0, 0, 2)));
        assertThat(line).doesNotContain("gold,").doesNotContain("+0").doesNotContain("−0");
    }

    @Test
    void summaryCarriesReasonAndStats() {
        terminal("").summary("game over", new Stats(0, 5, 7, 1234, 80), 150);
        assertThat(output()).isEqualTo(
                "Run ended: game over | score 1234 | turn 80 | level 7 | lives 0 | gold 5 | requests used 150\n");
    }

    @Test
    void summaryWithoutStats() {
        terminal("").summary("error: NETWORK", null, 1);
        assertThat(output()).isEqualTo("Run ended: error: NETWORK | requests used 1\n");
    }

    @Test
    void checkpointAcceptsYes() {
        assertThat(terminal("y\n").confirmMore(300, 100)).isTrue();
        assertThat(output()).contains("may expire").contains("Continue for 100 more requests? [y/N]");
        assertThat(terminal(" YES \n").confirmMore(300, 100)).isTrue();
    }

    @Test
    void checkpointDeclinesOnAnythingElseOrEof() {
        assertThat(terminal("n\n").confirmMore(300, 100)).isFalse();
        assertThat(terminal("\n").confirmMore(300, 100)).isFalse();
        assertThat(terminal("").confirmMore(300, 100)).isFalse();
    }
}
