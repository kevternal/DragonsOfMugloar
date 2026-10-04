package io.github.kevternal.dragonsofmugloar.npc.console;

import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * One game written to a plain-text file, for later analysis: no escape codes and no pause toggles.
 * Named {@code <start time>-<gameId>.txt}.
 */
final class HistoryFile {

    static final DateTimeFormatter FILE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

    private final PrintStream out;

    private HistoryFile(PrintStream out) {
        this.out = out;
    }

    static String fileName(String gameId, LocalDateTime start) {
        return start.format(FILE_TIME) + "-" + gameId + ".txt";
    }

    /** Creates the directory and the file, and writes the header line. */
    static HistoryFile create(Path dir, String gameId, LocalDateTime start) throws IOException {
        Path file = dir.resolve(fileName(gameId, start));
        Files.createDirectories(dir);
        PrintStream out = new PrintStream(Files.newOutputStream(file), true, StandardCharsets.UTF_8);
        out.println("Game " + gameId + " | started " + start.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        return new HistoryFile(out);
    }

    void println(String line) {
        out.println(line);
    }

    void close() {
        out.close();
    }
}
