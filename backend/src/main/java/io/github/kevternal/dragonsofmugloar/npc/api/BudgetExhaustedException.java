package io.github.kevternal.dragonsofmugloar.npc.api;

/** Thrown by {@code send()} before a request that would exceed the granted budget; nothing was sent. */
public class BudgetExhaustedException extends RuntimeException {

    public BudgetExhaustedException(int used) {
        super("Request budget reached after " + used + " requests");
    }
}
