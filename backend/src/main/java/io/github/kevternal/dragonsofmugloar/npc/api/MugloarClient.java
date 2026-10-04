package io.github.kevternal.dragonsofmugloar.npc.api;

import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * AD-2: the only HTTP caller. Every call goes through {@link #send}. There is no request spacing
 * and no request budget: requests go out as fast as the server answers, and one game plays until it ends.
 */
public class MugloarClient {

    /** Blocks for the given milliseconds; injected so tests never sleep for real. */
    @FunctionalInterface
    public interface Sleeper {

        /** Sleeps for real; an interrupt becomes an {@link IllegalStateException}. */
        Sleeper REAL = millis -> {
            try {
                Thread.sleep(millis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting", e);
            }
        };

        void sleep(long millis);
    }

    private final RestClient rest;
    private final List<Duration> retryDelays;
    private final Sleeper sleeper;
    private int used;

    /** The builder carries the HTTP client settings; tests bind a mock server to it. */
    public MugloarClient(RestClient.Builder builder, MugloarProperties properties, Sleeper sleeper) {
        this.rest = builder
                .baseUrl(properties.baseUrl())
                .defaultHeader("User-Agent", properties.userAgent())
                .defaultStatusHandler(HttpStatusCode::isError, (request, response) -> {
                    int status = response.getStatusCode().value();
                    throw new MugloarApiException(MugloarApiException.Kind.HTTP, status, "HTTP " + status, null);
                })
                .build();
        this.retryDelays = List.copyOf(properties.retryDelays());
        this.sleeper = sleeper;
    }

    public StartDto start() {
        return send(() -> rest.post().uri("/game/start").retrieve().body(StartDto.class));
    }

    public List<ShopItemDto> shop(String gameId) {
        // A bare array [V]; the docs claim {items: []}.
        ShopItemDto[] items = send(() -> rest.get().uri("/{gameId}/shop", gameId).retrieve().body(ShopItemDto[].class));
        return items == null ? List.of() : List.of(items);
    }

    /**
     * A bare array [V]; the docs claim {messages: []}. A 404 here means the game expired (AD-5).
     * The only retried call (AD-18): once per configured delay (2 s and 5 s).
     */
    public List<AdDto> messages(String gameId) {
        for (int attempt = 0; ; attempt++) {
            try {
                AdDto[] ads = send(() -> rest.get().uri("/{gameId}/messages", gameId).retrieve()
                        .onStatus(MugloarClient::isNotFound, (request, response) -> {
                            throw new MugloarApiException(MugloarApiException.Kind.EXPIRED, 404, "Game not found", null);
                        })
                        .body(AdDto[].class));
                return ads == null ? List.of() : List.of(ads);
            } catch (MugloarApiException e) {
                if (!e.retryable() || attempt >= retryDelays.size()) {
                    throw e;
                }

                sleeper.sleep(retryDelays.get(attempt).toMillis());
            }
        }
    }

    /** Never retried: a retry could take a second turn. A 404 means the ad is gone. */
    public SolveDto solve(String gameId, String adId) {
        return send(() -> rest.post().uri("/{gameId}/solve/{adId}", gameId, adId).retrieve()
                .onStatus(MugloarClient::isNotFound, (request, response) -> {
                    throw new MugloarApiException(MugloarApiException.Kind.GONE, 404, "Ad not found", null);
                })
                .body(SolveDto.class));
    }

    /** Never retried: a buy takes a turn even when it fails [V]. A 404 means the item is gone. */
    public BuyDto buy(String gameId, String itemId) {
        return send(() -> rest.post().uri("/{gameId}/shop/buy/{itemId}", gameId, itemId).retrieve()
                .onStatus(MugloarClient::isNotFound, (request, response) -> {
                    throw new MugloarApiException(MugloarApiException.Kind.GONE, 404, "Item not found", null);
                })
                .body(BuyDto.class));
    }

    /** Requests sent so far. */
    public int used() {
        return used;
    }

    private static boolean isNotFound(HttpStatusCode status) {
        return status.value() == HttpStatus.NOT_FOUND.value();
    }

    private <T> T send(Supplier<T> request) {
        used++;
        try {
            return request.get();
        } catch (ResourceAccessException e) {
            throw new MugloarApiException(MugloarApiException.Kind.NETWORK, null, e.getMessage(), e);
        } catch (RestClientException e) {
            throw new MugloarApiException(MugloarApiException.Kind.HTTP, null, e.getMessage(), e);
        }
    }
}
