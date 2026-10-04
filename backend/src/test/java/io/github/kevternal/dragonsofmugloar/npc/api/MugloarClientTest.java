package io.github.kevternal.dragonsofmugloar.npc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** AD-16: a mock server bound to the builder; no request reaches dragonsofmugloar.com, no real sleeps. */
class MugloarClientTest {

    private static final String BASE = "https://dragonsofmugloar.com/api/v2";
    private static final String USER_AGENT = "dragons-of-mugloar-npc/0.0.1";
    private static final MugloarProperties PROPERTIES =
            new MugloarProperties(BASE, USER_AGENT, List.of(Duration.ofSeconds(2), Duration.ofSeconds(5)));
    private static final String MESSAGES = BASE + "/g1/messages";
    private static final String START_JSON =
            "{\"gameId\":\"g1\",\"lives\":3,\"gold\":0,\"level\":0,\"score\":0,\"highScore\":0,\"turn\":0}";

    private MockRestServiceServer server;
    private MugloarClient client;
    private final List<Long> sleeps = new ArrayList<>();

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new MugloarClient(builder, PROPERTIES, sleeps::add);
    }

    @Test
    void parsesBareArraysAndSendsUserAgent() {
        server.expect(requestTo(BASE + "/game/start")).andExpect(method(HttpMethod.POST))
                .andExpect(header("User-Agent", USER_AGENT))
                .andRespond(withSuccess(START_JSON, MediaType.APPLICATION_JSON));
        server.expect(requestTo(MESSAGES)).andRespond(withSuccess("""
                [{"adId":"a1","message":"Help","reward":82,"expiresIn":3,"encrypted":null,"probability":"Sure thing"},
                 {"adId":"YjI=","message":"SGk=","reward":5,"expiresIn":1,"encrypted":1,"probability":"Umlza3k=","extra":true}]
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/g1/shop")).andRespond(withSuccess(
                "[{\"id\":\"hpot\",\"name\":\"Healing potion\",\"cost\":50}]", MediaType.APPLICATION_JSON));

        StartDto start = client.start();
        List<AdDto> ads = client.messages("g1");
        List<ShopItemDto> shop = client.shop("g1");

        assertThat(start).isEqualTo(new StartDto("g1", 3, 0, 0, 0, 0));
        assertThat(ads).containsExactly(new AdDto("a1", "Help", 82, 3, null, "Sure thing"),
                new AdDto("YjI=", "SGk=", 5, 1, 1, "Umlza3k="));
        assertThat(shop).containsExactly(new ShopItemDto("hpot", "Healing potion", 50));
        server.verify();
    }

    @Test
    void solveAndBuyResponsesParseWithAbsentFieldsAsNull() {
        server.expect(requestTo(BASE + "/g1/solve/a1")).andExpect(method(HttpMethod.POST)).andRespond(withSuccess(
                "{\"success\":true,\"lives\":3,\"gold\":82,\"score\":82,\"highScore\":0,\"turn\":1,\"message\":\"ok\"}",
                MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/g1/shop/buy/hpot")).andExpect(method(HttpMethod.POST)).andRespond(withSuccess(
                "{\"shoppingSuccess\":true,\"gold\":32,\"lives\":4,\"level\":0,\"turn\":2}", MediaType.APPLICATION_JSON));

        assertThat(client.solve("g1", "a1")).isEqualTo(new SolveDto(true, 3, 82, 82, 1, "ok"));
        assertThat(client.buy("g1", "hpot")).isEqualTo(new BuyDto(true, 32, 4, 0, 2));
        server.verify();
    }

    @Test
    void requestsGoOutBackToBackWithoutSpacing() {
        server.expect(times(4), requestTo(MESSAGES)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        for (int i = 0; i < 4; i++) {
            client.messages("g1");
        }

        assertThat(sleeps).isEmpty();
        assertThat(client.used()).isEqualTo(4);
        server.verify();
    }

    @Test
    void messagesRetriesTwiceAfter2And5Seconds() {
        server.expect(requestTo(MESSAGES)).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(requestTo(MESSAGES)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        server.expect(requestTo(MESSAGES)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThat(client.messages("g1")).isEmpty();
        assertThat(sleeps).containsExactly(2000L, 5000L);
        assertThat(client.used()).isEqualTo(3);
        server.verify();
    }

    @Test
    void messagesRetriesNetworkErrorsAndTimeouts() {
        server.expect(requestTo(MESSAGES)).andRespond(withException(new IOException("reset")));
        server.expect(requestTo(MESSAGES)).andRespond(withException(new SocketTimeoutException("read timed out")));
        server.expect(requestTo(MESSAGES)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThat(client.messages("g1")).isEmpty();
        assertThat(sleeps).containsExactly(2000L, 5000L);
        server.verify();
    }

    @Test
    void messagesGivesUpAfterTwoRetries() {
        server.expect(times(3), requestTo(MESSAGES)).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> client.messages("g1"))
                .isInstanceOfSatisfying(MugloarApiException.class, e -> {
                    assertThat(e.kind()).isEqualTo(MugloarApiException.Kind.HTTP);
                    assertThat(e.status()).isEqualTo(500);
                });
        assertThat(sleeps).containsExactly(2000L, 5000L);
        server.verify();
    }

    @Test
    void messages404WithHtmlBodyMeansExpiredAndIsNotRetried() {
        server.expect(once(), requestTo(MESSAGES)).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.TEXT_HTML).body("<!DOCTYPE html><html><body>Not Found</body></html>"));

        assertThatThrownBy(() -> client.messages("g1"))
                .isInstanceOfSatisfying(MugloarApiException.class,
                        e -> assertThat(e.kind()).isEqualTo(MugloarApiException.Kind.EXPIRED));
        assertThat(sleeps).isEmpty();
        server.verify();
    }

    @Test
    void solve404MeansGoneAndIsNotRetried() {
        server.expect(once(), requestTo(BASE + "/g1/solve/a1")).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.TEXT_HTML).body("<html>Not Found</html>"));

        assertThatThrownBy(() -> client.solve("g1", "a1"))
                .isInstanceOfSatisfying(MugloarApiException.class, e -> {
                    assertThat(e.kind()).isEqualTo(MugloarApiException.Kind.GONE);
                    assertThat(e.status()).isEqualTo(404);
                });
        assertThat(sleeps).isEmpty();
        server.verify();
    }

    @Test
    void buy404MeansGoneAndIsNotRetried() {
        server.expect(once(), requestTo(BASE + "/g1/shop/buy/hpot")).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.TEXT_HTML).body("<html>Not Found</html>"));

        assertThatThrownBy(() -> client.buy("g1", "hpot"))
                .isInstanceOfSatisfying(MugloarApiException.class, e -> {
                    assertThat(e.kind()).isEqualTo(MugloarApiException.Kind.GONE);
                    assertThat(e.status()).isEqualTo(404);
                });
        assertThat(sleeps).isEmpty();
        server.verify();
    }

    @Test
    void solveIsNeverRetried() {
        server.expect(once(), requestTo(BASE + "/g1/solve/a1")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> client.solve("g1", "a1")).isInstanceOf(MugloarApiException.class);
        assertThat(sleeps).isEmpty();
        assertThat(client.used()).isEqualTo(1);
        server.verify();
    }

    @Test
    void buyIsNeverRetried() {
        server.expect(once(), requestTo(BASE + "/g1/shop/buy/hpot"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> client.buy("g1", "hpot")).isInstanceOf(MugloarApiException.class);
        assertThat(sleeps).isEmpty();
        assertThat(client.used()).isEqualTo(1);
        server.verify();
    }

    @Test
    void networkErrorOnSolveIsNotRetried() {
        server.expect(once(), requestTo(BASE + "/g1/solve/a1")).andRespond(withException(new IOException("reset")));

        assertThatThrownBy(() -> client.solve("g1", "a1"))
                .isInstanceOfSatisfying(MugloarApiException.class,
                        e -> assertThat(e.kind()).isEqualTo(MugloarApiException.Kind.NETWORK));
        server.verify();
    }
}
