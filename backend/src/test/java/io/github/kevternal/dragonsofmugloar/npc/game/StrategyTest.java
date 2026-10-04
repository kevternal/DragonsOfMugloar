package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

class StrategyTest {

    private static final ShopItem POTION = new ShopItem("hpot", "Healing potion", 50);
    private static final ShopItem CLAW = new ShopItem("cs", "Claw Sharpening", 100);
    private static final ShopItem GAS = new ShopItem("gas", "Gasoline", 100);
    private static final ShopItem ROCKET = new ShopItem("rf", "Rocket Fuel", 300);
    // API order is not cost order, so shelfOrder matters.
    private static final List<ShopItem> SHOP = List.of(ROCKET, POTION, CLAW, GAS);

    private static Ad ad(String id, String probability, int reward, int expiresIn) {
        return new Ad(id, "msg " + id, reward, expiresIn, probability, true);
    }

    private static Stats stats(int lives, int gold) {
        return new Stats(lives, gold, 0, 0, 5);
    }

    @Test
    void lastLifeBuysPotionBeforeASafeAd() {
        List<Ad> board = List.of(ad("s", "Piece of cake", 100, 3));
        assertThat(Strategy.decide(stats(1, 60), board, SHOP)).contains(new Decision.Buy(POTION));
    }

    @Test
    void lastLifeWithoutGoldPlaysItSafe() {
        List<Ad> board = List.of(ad("r", "Risky", 500, 1), ad("s", "Sure thing", 10, 3));
        assertThat(Strategy.decide(stats(1, 40), board, SHOP)).contains(new Decision.Solve(board.get(1)));
    }

    @Test
    void twoLivesWithASafeAdSolvesItWithoutPotion() {
        List<Ad> board = List.of(ad("m", "Quite likely", 300, 2), ad("s", "Sure thing", 20, 3));
        assertThat(Strategy.decide(stats(2, 200), board, SHOP)).contains(new Decision.Solve(board.get(1)));
    }

    @Test
    void twoLivesWithNoSafeAdBuysPotion() {
        List<Ad> board = List.of(ad("m", "Quite likely", 300, 2));
        assertThat(Strategy.decide(stats(2, 200), board, SHOP)).contains(new Decision.Buy(POTION));
    }

    @Test
    void healthyOnAHardBoardBuysTheCheapestLevelItem() {
        List<Ad> board = List.of(ad("r", "Risky", 300, 2), ad("d", "Impossible", 900, 1));
        assertThat(Strategy.decide(stats(3, 100), board, SHOP)).contains(new Decision.Buy(CLAW));
    }

    @Test
    void hardBoardIgnoresUnknownAds() {
        List<Ad> board = List.of(ad("r", "Gamble", 300, 2), ad("u", "Brand new label", 900, 1));
        assertThat(Strategy.decide(stats(3, 100), board, SHOP)).contains(new Decision.Buy(CLAW));
    }

    @Test
    void hardBoardWhenBrokeSolvesTheTopAdForGlory() {
        List<Ad> board = List.of(ad("d", "Impossible", 900, 1), ad("r1", "Risky", 100, 2), ad("r2", "Gamble", 300, 4));
        assertThat(Strategy.decide(stats(3, 99), board, SHOP)).contains(new Decision.Solve(board.get(2)));
    }

    @Test
    void healthyNormalBoardSortsForGlory() {
        // Expected rewards: safe 50×100 = 5000, moderate 100×70 = 7000, deadly 1000×10 = 10000 but deadly is last.
        List<Ad> board = List.of(ad("s", "Piece of cake", 50, 1), ad("m", "Walk in the park", 100, 5),
                ad("d", "Suicide mission", 1000, 1));
        assertThat(Strategy.decide(stats(3, 500), board, SHOP)).contains(new Decision.Solve(board.get(1)));
    }

    @Test
    void encryptedAdIsDecodedAndUsedWhileUnknownLabelSortsLast() {
        Ad decoded = AdDecoder.decode("vq", "Uryc", "Fher guvat", 30, 3, 2);
        Ad unknown = ad("u", "Brand new label", 9999, 1);
        Ad undecodable = AdDecoder.decode("x", "y", "z", 99999, 1, 7);
        List<Ad> board = List.of(unknown, undecodable, decoded);
        assertThat(Strategy.decide(stats(3, 0), board, SHOP)).contains(new Decision.Solve(decoded));
        assertThat(Strategy.sortJobs(board, Strategy.SortMode.FOR_GLORY)).containsExactly(decoded, undecodable, unknown);
    }

    @Test
    void unknownLabelIsSolvedWhenNothingElseIs() {
        Ad unknown = ad("u", "Brand new label", 10, 1);
        assertThat(Strategy.decide(stats(3, 0), List.of(unknown), SHOP)).contains(new Decision.Solve(unknown));
    }

    @Test
    void noSolvableAdMeansNoPlayableMove() {
        Ad undecodable = AdDecoder.decode("x", "y", "z", 10, 1, 9);
        assertThat(Strategy.decide(stats(3, 0), List.of(undecodable), SHOP)).isEqualTo(Optional.empty());
        assertThat(Strategy.decide(stats(3, 0), List.of(), SHOP)).isEmpty();
    }

    @Test
    void playItSafeSortsByRiskThenRewardThenExpiryThenId() {
        Ad a = ad("a", "Quite likely", 100, 3);
        Ad b = ad("b", "Sure thing", 10, 3);
        Ad c = ad("c", "Piece of cake", 10, 1);
        Ad d = ad("d", "Piece of cake", 10, 1);
        Ad u = ad("u", "Brand new label", 500, 1);
        assertThat(Strategy.sortJobs(List.of(u, a, d, b, c), Strategy.SortMode.PLAY_IT_SAFE))
                .containsExactly(c, d, b, a, u);
    }

    @Test
    void forGlorySortsDeadlyLastThenExpectedReward() {
        Ad tie1 = ad("t1", "Quite likely", 4, 5); // 280
        Ad tie2 = ad("t2", "Gamble", 7, 2); // 280, expires sooner
        Ad deadly = ad("d", "Impossible", 1000, 1);
        Ad safe = ad("s", "Sure thing", 3, 1); // 300
        assertThat(Strategy.sortJobs(List.of(deadly, tie1, tie2, safe), Strategy.SortMode.FOR_GLORY))
                .containsExactly(safe, tie2, tie1, deadly);
    }

    @Test
    void unknownShopItemIsNeitherLifeNorLevel() {
        ShopItem mystery = new ShopItem("mystery", "Mystery", 1);
        List<Ad> board = List.of(ad("r", "Risky", 300, 2));
        assertThat(Strategy.decide(stats(1, 1000), board, List.of(mystery))).contains(new Decision.Solve(board.get(0)));
    }

    @Test
    void shelfOrderIsCostThenApiOrder() {
        assertThat(Strategy.shelfOrder(SHOP)).containsExactly(POTION, CLAW, GAS, ROCKET);
    }
}
