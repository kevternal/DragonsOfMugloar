package io.github.kevternal.dragonsofmugloar.npc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.PrintStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import io.github.kevternal.dragonsofmugloar.npc.api.MugloarClient;
import io.github.kevternal.dragonsofmugloar.npc.console.PauseControl;
import io.github.kevternal.dragonsofmugloar.npc.console.Terminal;

/** The loop end to end against a mock server (AD-16); sleeps are no-ops. Output is plain mode. */
class NpcRunnerTest {

    private static final String BASE = "https://dragonsofmugloar.com/api/v2";
    private static final String SAFE_BOARD = "[{\"adId\":\"a1\",\"message\":\"Slay\",\"reward\":40,\"expiresIn\":2,"
            + "\"encrypted\":null,\"probability\":\"Sure thing\"}]";

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final MugloarClient client = new MugloarClient(builder, millis -> { });
    private final ByteArrayOutputStream out = new ByteArrayOutputStream();

    private NpcRunner runner(PauseControl pause) {
        return new NpcRunner(client, new Terminal(new PrintStream(out, true, StandardCharsets.UTF_8), false), pause);
    }

    private NpcRunner runner() {
        return runner(new PauseControl(idleStdin()));
    }

    /** A connected pipe nobody writes to: the pause control waits forever, so its state never changes. */
    private static InputStream idleStdin() {
        try {
            return new PipedInputStream(new PipedOutputStream());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String output() {
        return out.toString(StandardCharsets.UTF_8);
    }

    private void respond(String path, String json) {
        server.expect(requestTo(BASE + path)).andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    private void startAndShop(int lives, int gold) {
        respond("/game/start", "{\"gameId\":\"g1\",\"lives\":%d,\"gold\":%d,\"level\":2,\"score\":10,\"turn\":0}"
                .formatted(lives, gold));
        respond("/g1/shop", "[{\"id\":\"hpot\",\"name\":\"Healing potion\",\"cost\":50}]");
    }

    private static String solved(int lives, int turn) {
        return "{\"success\":true,\"lives\":%d,\"gold\":%d,\"score\":%d,\"turn\":%d,\"message\":\"ok\"}"
                .formatted(lives, turn, turn, turn);
    }

    @Test
    void playsUntilGameOverWithoutRefetching() {
        startAndShop(1, 0);
        respond("/g1/messages",
                "[{\"adId\":\"a1\",\"message\":\"Slay\",\"reward\":40,\"expiresIn\":2,\"encrypted\":null,\"probability\":\"Gamble\"}]");
        respond("/g1/solve/a1", "{\"success\":false,\"lives\":0,\"gold\":0,\"score\":10,\"turn\":1,"
                + "\"message\":\"You were defeated on your last mission!\"}");

        runner().run(null);

        server.verify();
        assertThat(output()).isEqualTo("""
                Turn 0 | Lives 1 | Level 2 | Gold 0 | Score 10 | ▶ running · Enter = pause
                 ✗ Solve  Slay (Gamble, 40)
                   You were defeated on your last mission!
                   −1 life
                Turn 1 | Lives 0 | Level 2 | Gold 0 | Score 10 | ▶ running · Enter = pause
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

        runner().run(null);

        server.verify();
        assertThat(output()).contains(" ✓ Buy    Healing potion\n   −50 gold, +1 life\n")
                .contains("Turn 1 | Lives 2 | Level 3 | Gold 10 | Score 10 |")
                .endsWith("Run ended: no playable move | score 10 | turn 1 | level 3 | lives 2 | gold 10 | requests used 5\n");
    }

    @Test
    void expiredGameEndsTheRun() {
        startAndShop(3, 0);
        server.expect(requestTo(BASE + "/g1/messages")).andRespond(withStatus(HttpStatus.NOT_FOUND));

        runner().run(null);

        server.verify();
        assertThat(output()).endsWith("Run ended: game expired | score 10 | turn 0 | level 2 | lives 3 | gold 0 | requests used 3\n");
    }

    @Test
    void longGamePlaysPast300RequestsWithNoPrompt() {
        startAndShop(3, 0);
        // 2 + 2 × 200 = 402 requests; the last solve ends the game.
        for (int turn = 1; turn <= 200; turn++) {
            respond("/g1/messages", SAFE_BOARD);
            respond("/g1/solve/a1", solved(turn == 200 ? 0 : 3, turn));
        }

        runner().run(null);

        server.verify();
        assertThat(output()).doesNotContain("Continue").doesNotContain("budget")
                .endsWith("Run ended: game over | score 200 | turn 200 | level 2 | lives 0 | gold 200 | requests used 402\n");
    }

    private static final String TWO_SAFE_BOARD = "[{\"adId\":\"a1\",\"message\":\"Slay\",\"reward\":40,\"expiresIn\":2,"
            + "\"encrypted\":null,\"probability\":\"Sure thing\"},"
            + "{\"adId\":\"a2\",\"message\":\"Guard\",\"reward\":30,\"expiresIn\":2,"
            + "\"encrypted\":null,\"probability\":\"Piece of cake\"}]";

    private void notFound(String path) {
        server.expect(requestTo(BASE + path)).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.TEXT_HTML).body("<html>Not Found</html>"));
    }

    @Test
    void solve404RemembersTheAdAndDecidesAgainOnAReread() {
        startAndShop(3, 0);
        respond("/g1/messages", TWO_SAFE_BOARD);
        notFound("/g1/solve/a1");
        // a1 is still listed on the re-read, but it is never picked again.
        respond("/g1/messages", TWO_SAFE_BOARD);
        respond("/g1/solve/a2", solved(3, 1));
        respond("/g1/messages", TWO_SAFE_BOARD);
        respond("/g1/solve/a2", solved(0, 2));

        runner().run(null);

        server.verify();
        assertThat(output()).contains(" ✓ Solve  Guard (Piece of cake, 30)").doesNotContain("Slay (")
                .endsWith("Run ended: game over | score 2 | turn 2 | level 2 | lives 0 | gold 2 | requests used 8\n");
    }

    @Test
    void solve404ThenReread404EndsWithBoardUnavailable() {
        startAndShop(3, 0);
        respond("/g1/messages", TWO_SAFE_BOARD);
        notFound("/g1/solve/a1");
        notFound("/g1/messages");

        runner().run(null);

        server.verify();
        assertThat(output()).endsWith("Run ended: board unavailable | score 10 | turn 0 | level 2 | lives 3 | gold 0 | requests used 5\n");
    }

    @Test
    void solve404ThenNothingPlayableEndsWithBoardUnavailable() {
        startAndShop(3, 0);
        respond("/g1/messages", SAFE_BOARD);
        notFound("/g1/solve/a1");
        respond("/g1/messages", SAFE_BOARD);

        runner().run(null);

        server.verify();
        assertThat(output()).endsWith("Run ended: board unavailable | score 10 | turn 0 | level 2 | lives 3 | gold 0 | requests used 5\n");
    }

    @Test
    void buy404DropsTheItemAndDecidesAgainOnAReread() {
        startAndShop(1, 60);
        respond("/g1/messages", SAFE_BOARD);
        notFound("/g1/shop/buy/hpot");
        respond("/g1/messages", SAFE_BOARD);
        respond("/g1/solve/a1", solved(0, 1));

        runner().run(null);

        server.verify();
        assertThat(output()).contains(" ✓ Solve  Slay (Sure thing, 40)")
                .endsWith("Run ended: game over | score 1 | turn 1 | level 2 | lives 0 | gold 1 | requests used 6\n");
    }

    @Test
    void baitSightingIsLoggedWithTheStateEstimateFromSuccessfulSolves() {
        startAndShop(3, 0);
        respond("/g1/messages", "[{\"adId\":\"s1\",\"message\":\"Steal cows delivery to Ann\",\"reward\":40,"
                + "\"expiresIn\":2,\"encrypted\":null,\"probability\":\"Sure thing\"}]");
        respond("/g1/solve/s1", solved(3, 1));
        respond("/g1/messages", "[{\"adId\":\"b1\",\"message\":\"Steal super awesome diamond ring from Bob\","
                + "\"reward\":150,\"expiresIn\":2,\"encrypted\":null,\"probability\":\"Sure thing\"},"
                + SAFE_BOARD.substring(1));
        respond("/g1/solve/a1", solved(0, 2));

        runner().run(null);

        server.verify();
        assertThat(output()).containsOnlyOnce(" ! Bait   1 ad on the board | state estimate -2\n")
                .doesNotContain("diamond ring from Bob (")
                .contains(" ✓ Solve  Slay (Sure thing, 40)");
    }

    @Test
    void pauseBetweenTurnsSendsNothingUntilResumed() throws Exception {
        PipedOutputStream keyboard = new PipedOutputStream();
        PauseControl pause = new PauseControl(new PipedInputStream(keyboard));
        startAndShop(3, 0);
        respond("/g1/messages", SAFE_BOARD);
        // Enter is pressed while turn 1's solve is in flight: the solve still finishes and is logged.
        server.expect(requestTo(BASE + "/g1/solve/a1")).andRespond(request -> {
            pressEnter(keyboard);
            spinUntil(pause::paused);
            return withSuccess(solved(3, 1), MediaType.APPLICATION_JSON).createResponse(request);
        });
        respond("/g1/messages", SAFE_BOARD);
        respond("/g1/solve/a1", solved(0, 2));

        Thread game = new Thread(() -> runner(pause).run(null));
        game.start();
        spinUntil(() -> game.getState() == Thread.State.WAITING);
        spinUntil(() -> output().contains("⏸ paused · Enter = resume")); // printed by the reader thread

        assertThat(client.used()).as("start, shop, messages, solve; nothing more while paused").isEqualTo(4);
        assertThat(output()).contains(" ✓ Solve  Slay (Sure thing, 40)").doesNotContain("Turn 2");

        pressEnter(keyboard);
        game.join(TimeUnit.SECONDS.toMillis(5));

        server.verify();
        String output = output();
        assertThat(output.indexOf("⏸ paused")).isLessThan(output.lastIndexOf("▶ running · Enter = pause"));
        assertThat(output).endsWith("Run ended: game over | score 2 | turn 2 | level 2 | lives 0 | gold 2 | requests used 6\n");
    }

    @Test
    void pauseDuringMessagesFetchHoldsTheSolveUntilResumed() throws Exception {
        PipedOutputStream keyboard = new PipedOutputStream();
        PauseControl pause = new PauseControl(new PipedInputStream(keyboard));
        startAndShop(3, 0);
        // Enter is pressed while turn 1's messages fetch is in flight.
        server.expect(requestTo(BASE + "/g1/messages")).andRespond(request -> {
            pressEnter(keyboard);
            spinUntil(pause::paused);
            return withSuccess(SAFE_BOARD, MediaType.APPLICATION_JSON).createResponse(request);
        });
        respond("/g1/solve/a1", solved(0, 1));

        Thread game = new Thread(() -> runner(pause).run(null));
        game.start();
        spinUntil(() -> game.getState() == Thread.State.WAITING);

        assertThat(client.used()).as("start, shop, messages; no solve while paused").isEqualTo(3);
        assertThat(output()).doesNotContain("Solve");

        pressEnter(keyboard);
        game.join(TimeUnit.SECONDS.toMillis(5));

        server.verify();
        assertThat(output()).contains(" ✓ Solve  Slay (Sure thing, 40)")
                .endsWith("Run ended: game over | score 1 | turn 1 | level 2 | lives 0 | gold 1 | requests used 4\n");
    }

    private static void pressEnter(PipedOutputStream keyboard) {
        try {
            keyboard.write('\n');
            keyboard.flush();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Spins (no sleep) until the condition holds, failing after 5 s. */
    private static void spinUntil(BooleanSupplier condition) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean()) {
            assertThat(System.nanoTime()).as("condition should hold").isLessThan(deadline);
            Thread.onSpinWait();
        }
    }
}
