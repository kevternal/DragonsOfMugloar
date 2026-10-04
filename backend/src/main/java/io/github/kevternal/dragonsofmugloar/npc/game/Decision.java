package io.github.kevternal.dragonsofmugloar.npc.game;

/** The move the NPC picked for this turn. */
public sealed interface Decision {

    record Solve(Ad ad) implements Decision {
    }

    record Buy(ShopItem item) implements Decision {
    }
}
