package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;

/**
 * Enter toggles pause and resume. A daemon thread reads lines, so no raw terminal mode is needed.
 * The game loop calls {@link #awaitRunning()} between turns, so a pause never interrupts a request.
 * EOF (or a read error) turns the control off and leaves the game running.
 */
public class PauseControl {

    /** Told about every change; called on the reader thread, outside this object's lock. */
    public interface Listener {

        /** One line was read (the user pressed Enter, which the terminal echoed). */
        void toggled(boolean paused);

        /** Stdin is closed; pausing is no longer available and the game runs. */
        void inputClosed();
    }

    private final InputStream in;
    private boolean paused;

    public PauseControl(InputStream in) {
        this.in = in;
    }

    /** Starts the reader thread. */
    public void start(Listener listener) {
        Thread reader = new Thread(() -> read(listener), "npc-pause-control");
        reader.setDaemon(true);
        reader.start();
    }

    public synchronized boolean paused() {
        return paused;
    }

    /** Blocks while paused. */
    public synchronized void awaitRunning() throws InterruptedException {
        while (paused) {
            wait();
        }
    }

    private void read(Listener listener) {
        BufferedReader lines = new BufferedReader(new InputStreamReader(in, Charset.defaultCharset()));
        try {
            while (lines.readLine() != null) {
                boolean now;
                synchronized (this) {
                    paused = !paused;
                    now = paused;
                    notifyAll();
                }
                listener.toggled(now);
            }
        } catch (IOException e) {
            // Treated as EOF: the control is off, and the game keeps running.
        }
        synchronized (this) {
            paused = false;
            notifyAll();
        }
        listener.inputClosed();
    }
}
