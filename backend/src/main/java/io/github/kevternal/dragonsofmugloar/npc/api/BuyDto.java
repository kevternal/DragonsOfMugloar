package io.github.kevternal.dragonsofmugloar.npc.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * {@code POST /:gameId/shop/buy/:itemId}: {@code {shoppingSuccess, gold, lives, level, turn}} [V].
 * No {@code score} [V]. Stat fields are nullable so an absent field leaves the stat unchanged.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record BuyDto(boolean shoppingSuccess, Integer gold, Integer lives, Integer level, Integer turn) {
}
