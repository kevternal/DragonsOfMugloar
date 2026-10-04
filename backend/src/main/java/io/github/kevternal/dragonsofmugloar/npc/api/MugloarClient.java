package io.github.kevternal.dragonsofmugloar.npc.api;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * AD-2: the only HTTP caller. Every call goes through {@link #send}: pacing, then the budget
 * check, then the request.
 */
public class MugloarClient {

    static final String BASE_URL = "https://dragonsofmugloar.com/api/v2";
    /** Python's default UA got 403 [V]; Java's default is [U], so send our own. */
    static final String USER_AGENT = "dragons-of-mugloar-npc/0.0.1";
    static final long MIN_SPACING_NANOS = TimeUnit.MILLISECONDS.toNanos(500);
    static final int INITIAL_BUDGET = 300;
    /** AD-18: delays before the first and second retry of {@code GET messages}. */
    static final long[] RETRY_DELAYS_MS = {2000, 5000};

    /** Blocks for the given milliseconds; injected so tests never sleep for real. */
    @FunctionalInterface
    public interface Sleeper {
        void sleep(long millis);
    }

    private final RestClient rest;
    private final LongSupplier nanoClock;
    private final Sleeper sleeper;
    private long lastStartNanos;
    private boolean anySent;
    private int used;
    private int budget = INITIAL_BUDGET;

    public MugloarClient(RestClient.Builder builder, LongSupplier nanoClock, Sleeper sleeper) {
        this.rest = builder
                .baseUrl(BASE_URL)
                .defaultHeader("User-Agent", USER_AGENT)
                .defaultStatusHandler(HttpStatusCode::isError, (request, response) -> {
                    int status = response.getStatusCode().value();
                    throw new MugloarApiException(MugloarApiException.Kind.HTTP, status, "HTTP " + status, null);
                })
                .build();
        this.nanoClock = nanoClock;
        this.sleeper = sleeper;
    }

    /** The production client: 5 s connect and 10 s read timeouts, the system clock, real sleeps. */
    public static MugloarClient create() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        return new MugloarClient(RestClient.builder().requestFactory(factory), System::nanoTime, millis -> {
            try {
                Thread.sleep(millis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting", e);
            }
        });
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
     * The only retried call (AD-18): at most twice, after 2 s and 5 s.
     */
    public List<AdDto> messages(String gameId) {
        for (int attempt = 0; ; attempt++) {
            try {
                AdDto[] ads = send(() -> rest.get().uri("/{gameId}/messages", gameId).retrieve()
                        .onStatus(status -> status.value() == HttpStatus.NOT_FOUND.value(), (request, response) -> {
                            throw new MugloarApiException(MugloarApiException.Kind.EXPIRED, 404, "Game not found", null);
                        })
                        .body(AdDto[].class));
                return ads == null ? List.of() : List.of(ads);
            } catch (MugloarApiException e) {
                if (!e.retryable() || attempt >= RETRY_DELAYS_MS.length) {
                    throw e;
                }
                sleeper.sleep(RETRY_DELAYS_MS[attempt]);
            }
        }
    }

    /** Never retried: a retry could take a second turn. */
    public SolveDto solve(String gameId, String adId) {
        return send(() -> rest.post().uri("/{gameId}/solve/{adId}", gameId, adId).retrieve().body(SolveDto.class));
    }

    /** Never retried: a buy takes a turn even when it fails [V]. */
    public BuyDto buy(String gameId, String itemId) {
        return send(() -> rest.post().uri("/{gameId}/shop/buy/{itemId}", gameId, itemId).retrieve().body(BuyDto.class));
    }

    /** Raises the request budget by {@code requests}. */
    public void grant(int requests) {
        budget += requests;
    }

    /** Requests sent so far. */
    public int used() {
        return used;
    }

    private <T> T send(Supplier<T> request) {
        pace();
        if (used >= budget) {
            throw new BudgetExhaustedException(used);
        }
        used++;
        lastStartNanos = nanoClock.getAsLong();
        anySent = true;
        try {
            return request.get();
        } catch (MugloarApiException e) {
            throw e;
        } catch (ResourceAccessException e) {
            throw new MugloarApiException(MugloarApiException.Kind.NETWORK, null, e.getMessage(), e);
        } catch (RestClientException e) {
            throw new MugloarApiException(MugloarApiException.Kind.HTTP, null, e.getMessage(), e);
        }
    }

    /** At least 500 ms between request starts, on a monotonic clock. */
    private void pace() {
        if (!anySent) {
            return;
        }
        long waitNanos = MIN_SPACING_NANOS - (nanoClock.getAsLong() - lastStartNanos);
        if (waitNanos > 0) {
            sleeper.sleep(TimeUnit.NANOSECONDS.toMillis(waitNanos + TimeUnit.MILLISECONDS.toNanos(1) - 1));
        }
    }
}
