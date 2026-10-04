package io.github.kevternal.dragonsofmugloar.npc.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One ad as the live API sends it. {@code reward} is a number [V]; the docs say string.
 * {@code encrypted} is null, 1 or 2 so far [V], so it stays a nullable Integer.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AdDto(String adId, String message, int reward, int expiresIn, Integer encrypted, String probability) {
}
