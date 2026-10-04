package io.github.kevternal.dragonsofmugloar.npc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.console.Terminal;

/** The loop end to end against a mock server (AD-16); sleeps are no-ops. */
class NpcRunnerTest {

    private static final String BASE = "https://dragonsofmugloar.com/api/v2";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final ByteArrayOutputStream out = new ByteArrayOutputStream();

    private NpcRunner runner(String input) {
        MugloarClient client = new MugloarClient(builder, System::nanoTime, millis -> { });
        Terminal terminal = new Terminal(new PrintStream(out, true, StandardCharsets.UTF_8),
                new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8)));
        return new NpcRunner(client, terminal);
    }

    private void respond(String path, String json) {
        server.expect(requestTo(BASE + path)).andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    private void startAndShop(int lives, int gold) {
        respond("/game/start", "{\"gameId\":\"g1\",\"lives\":%d,\"gold\":%d,\"level\":2,\"score\":10,\"turn\":0}"
                .formatted(lives, gold));
        respond("/g1/shop", "[{\"id\":\"hpot\",\"name\":\"Healing potion\",\"cost\":50}]");
    }

    @Test
    void playsUntilGameOverWithoutRefetching() {
        startAndShop(1, 0);
        respond("/g1/messages",
                "[{\"adId\":\"a1\",\"message\":\"Slay\",\"reward\":40,\"expiresIn\":2,\"encrypted\":null,\"probability\":\"Gamble\"}]");
        respond("/g1/solve/a1", "{\"success\":false,\"lives\":0,\"gold\":0,\"score\":10,\"turn\":1,"
                + "\"message\":\"You were defeated on your last mission!\"}");

        runner("").run(null);

        server.verify();
        assertThat(out.toString(StandardCharsets.UTF_8)).isEqualTo("""
                T1   ✗ Solve  Slay (Gamble, 40)                            −1 life         | lives 0 | level 2 | gold 0 | score 10 | turn 1
                       You were defeated on your last mission!
                Run ended: game over | score 10 | turn 1 | level 2 | lives 0 | gold 0 | requests used 4
                """);
    }

    @Test
    void buyKeepsScoreAndTracksLevelThenStopsWithNoPlayableMove() {
        startAndShop(1, 60);
        respond("/g1/messages",
                "[{\"adId\":\"a1\",\"message\":\"Slay\",\"reward\":40,\"expiresIn\":2,\"encrypted\":null,\"probability\":\"Gamble\"}]");
        respond("/g1/shop/buy/hpot", "{\"shoppingSuccess\":true,\"gold\":10,\"lives\":2,\"level\":3,\"turn\":1}");
        respond("/g1/messages", "[]");

        runner("").run(null);

        server.verify();
        String output = out.toString(StandardCharsets.UTF_8);
        assertThat(output).contains("T1   ✓ Buy    Healing potion").contains("−50 gold, +1 life")
                .contains("| lives 2 | level 3 | gold 10 | score 10 | turn 1");
        assertThat(output).endsWith("Run ended: no playable move | score 10 | turn 1 | level 3 | lives 2 | gold 10 | requests used 5\n");
    }

    @Test
    void expiredGameEndsTheRun() {
        startAndShop(3, 0);
        server.expect(requestTo(BASE + "/g1/messages")).andRespond(withStatus(HttpStatus.NOT_FOUND));

        runner("").run(null);

        server.verify();
        assertThat(out.toString(StandardCharsets.UTF_8)).startsWith("Run ended: game expired | score 10 | turn 0");
    }

    @Test
    void checkpointYesRerunsTheSameStepAndEofDeclines() {
        startAndShop(3, 0);
        String board = "[{\"adId\":\"a1\",\"message\":\"Slay\",\"reward\":40,\"expiresIn\":2,\"encrypted\":null,"
                + "\"probability\":\"Sure thing\"}]";
        // Requests: start, shop, then messages + solve per turn. Turn 149's solve is request 300, so
        // the checkpoint hits before turn 150's messages; "y" re-runs that same fetch. Turn 199's solve
        // is request 400, so the second checkpoint hits before turn 200's messages, and EOF declines.
        for (int turn = 1; turn <= 199; turn++) {
            respond("/g1/messages", board);
            respond("/g1/solve/a1", "{\"success\":true,\"lives\":3,\"gold\":%d,\"score\":%d,\"turn\":%d,\"message\":\"ok\"}"
                    .formatted(turn, turn, turn));
        }

        runner("y\n").run(null);

        server.verify();
        String output = out.toString(StandardCharsets.UTF_8);
        assertThat(output.split("Continue for 100 more requests\\? \\[y/N]", -1)).hasSize(3);
        assertThat(output).contains("T150 ✓ Solve").contains("T199 ✓ Solve").doesNotContain("T200");
        assertThat(output).endsWith("Run ended: budget exhausted | score 199 | turn 199 | level 2 | lives 3 | gold 199 | requests used 400\n");
    }
}
