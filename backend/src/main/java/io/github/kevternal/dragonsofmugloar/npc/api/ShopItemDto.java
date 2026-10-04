package io.github.kevternal.dragonsofmugloar.npc.api;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** One shop item: {@code {id, name, cost}} [V]. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ShopItemDto(String id, String name, int cost) {
}
