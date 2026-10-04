package io.github.kevternal.dragonsofmugloar.npc.api;

/** AD-5: the one error shape of the API layer. */
public class MugloarApiException extends RuntimeException {

    public enum Kind {
        /** A 404 from {@code GET messages}: the game is over or expired [V]. */
        EXPIRED,
        /** A 404 from solve or buy: the ad or item is gone; never retried. */
        GONE,
        /** Any other non-2xx response, or a body that could not be read. */
        HTTP,
        /** No response: connect failure, read timeout, I/O error. */
        NETWORK
    }

    private final Kind kind;
    private final Integer status;

    public MugloarApiException(Kind kind, Integer status, String message, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.status = status;
    }

    public Kind kind() {
        return kind;
    }

    /** The HTTP status, or null when there was no response. */
    public Integer status() {
        return status;
    }

    /** AD-18: a network error, read timeout, 5xx or 429 may be retried. */
    boolean retryable() {
        return kind == Kind.NETWORK || (status != null && (status >= 500 || status == 429));
    }
}
