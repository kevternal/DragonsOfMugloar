package io.github.kevternal.dragonsofmugloar.npc.console;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

/** Piped streams and blocking hand-offs; no real sleeps. */
class PauseControlTest {

    private final PipedOutputStream keyboard = new PipedOutputStream();
    private final PipedInputStream stdin;
    private final PauseControl control;
    private final BlockingQueue<String> events = new LinkedBlockingQueue<>();

    PauseControlTest() throws IOException {
        stdin = new PipedInputStream(keyboard);
        control = new PauseControl(stdin, new PauseControl.Listener() {
            @Override
            public void toggled(boolean paused) {
                events.add(paused ? "paused" : "running");
            }

            @Override
            public void inputClosed() {
                events.add("closed");
            }
        });
        control.start();
    }

    private void pressEnter() throws IOException {
        keyboard.write("\n".getBytes(StandardCharsets.UTF_8));
        keyboard.flush();
    }

    private String nextEvent() throws InterruptedException {
        String event = events.poll(5, TimeUnit.SECONDS);
        assertThat(event).as("listener event").isNotNull();
        return event;
    }

    @Test
    void eachLineTogglesAndNotifies() throws Exception {
        assertThat(control.paused()).isFalse();
        pressEnter();
        assertThat(nextEvent()).isEqualTo("paused");
        assertThat(control.paused()).isTrue();
        pressEnter();
        assertThat(nextEvent()).isEqualTo("running");
        assertThat(control.paused()).isFalse();
    }

    @Test
    void awaitRunningBlocksWhilePausedAndReturnsOnResume() throws Exception {
        control.awaitRunning(); // running: returns at once
        pressEnter();
        assertThat(nextEvent()).isEqualTo("paused");

        CountDownLatch resumed = new CountDownLatch(1);
        Thread game = new Thread(() -> {
            try {
                control.awaitRunning();
                resumed.countDown();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        game.start();
        waitUntilWaiting(game);
        assertThat(resumed.getCount()).isEqualTo(1);

        pressEnter();
        assertThat(resumed.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(nextEvent()).isEqualTo("running");
    }

    @Test
    void eofWhilePausedResumesAndTurnsTheControlOff() throws Exception {
        pressEnter();
        assertThat(nextEvent()).isEqualTo("paused");
        keyboard.close();
        assertThat(nextEvent()).isEqualTo("closed");
        assertThat(control.paused()).isFalse();
        control.awaitRunning(); // returns at once
    }

    /** Spins (no sleep) until the thread blocks in {@code wait()}. */
    static void waitUntilWaiting(Thread thread) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (thread.getState() != Thread.State.WAITING) {
            assertThat(System.nanoTime()).as("thread should block").isLessThan(deadline);
            Thread.onSpinWait();
        }
    }
}
