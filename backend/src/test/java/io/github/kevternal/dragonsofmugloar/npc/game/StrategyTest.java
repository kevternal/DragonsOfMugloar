package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/** Tree v3.2, from the plan's I/O and edge-case matrix. */
class StrategyTest {

    private static final ShopItem POTION = new ShopItem("hpot", "Healing potion", 50);
    private static final ShopItem CLAW_1 = new ShopItem("cs", "Claw Sharpening", 100);
    private static final ShopItem GAS_1 = new ShopItem("gas", "Gas", 100);
    private static final ShopItem CLAW_2 = new ShopItem("ch", "Claw Honing", 300);
    private static final ShopItem FIRE_2 = new ShopItem("rf", "Rocket Fuel", 300);
    private static final ShopItem IRON_2 = new ShopItem("iron", "Iron Plating", 300);
    // API order is not cost order.
    private static final List<ShopItem> SHOP = List.of(CLAW_2, FIRE_2, IRON_2, POTION, CLAW_1, GAS_1);

    private static Ad ad(String id, String probability, int reward) {
        return ad(id, "Help " + id, probability, reward, 3);
    }

    private static Ad ad(String id, String message, String probability, int reward, int expiresIn) {
        return new Ad(id, message, reward, expiresIn, probability, true);
    }

    private static Stats stats(int lives, int gold) {
        return new Stats(lives, gold, 0, 0, 5);
    }

    private static Optional<Decision> decide(Stats stats, List<Ad> board) {
        return Strategy.decide(stats, board, SHOP, Map.of(), 0);
    }

    private static Optional<Decision> solve(Ad ad) {
        return Optional.of(new Decision.Solve(ad));
    }

    private static Optional<Decision> buy(ShopItem item) {
        return Optional.of(new Decision.Buy(item));
    }

    @Test
    void baitIsNeverChosen() {
        Ad bait = ad("b", "Steal super awesome diamond ring from Bob", "Sure thing", 500, 3);
        Ad plain = ad("p", "Piece of cake", 20);
        assertThat(decide(stats(3, 100), List.of(bait, plain))).isEqualTo(solve(plain));
        assertThat(decide(stats(3, 100), List.of(bait))).isEmpty();
    }

    @Test
    void stealIsBlockedWhenOneMoreWouldGoBelowMinus8() {
        Ad steal = ad("s", "Steal cows delivery to Ann", "Sure thing", 300, 3);
        Ad help = ad("h", "Piece of cake", 20);
        List<Ad> board = List.of(steal, help);
        // −7 − 2 = −9 < −8: blocked.
        assertThat(Strategy.decide(stats(3, 100), board, SHOP, Map.of(), -7)).isEqualTo(solve(help));
        // −6 − 2 = −8, not below −8: allowed (the plan's rule "stateEstimate − 2 < −8").
        assertThat(Strategy.decide(stats(3, 100), board, SHOP, Map.of(), -6)).isEqualTo(solve(steal));
    }

    @Test
    void stealIsBlockedWhileBaitIsOnTheBoard() {
        Ad steal = ad("s", "Steal cows delivery to Ann", "Sure thing", 300, 3);
        Ad bait = ad("b", "Steal super awesome diamond ring from Bob", "Sure thing", 500, 3);
        Ad help = ad("h", "Piece of cake", 20);
        assertThat(Strategy.decide(stats(3, 100), List.of(steal, bait, help), SHOP, Map.of(), 0))
                .isEqualTo(solve(help));
    }

    @Test
    void onlyStealsLeftPlaysTheBestSteal() {
        Ad steal1 = ad("s1", "Steal cows delivery to Ann", "Sure thing", 100, 3);
        Ad steal2 = ad("s2", "Steal sheep delivery to Bo", "Sure thing", 200, 3);
        assertThat(Strategy.decide(stats(3, 100), List.of(steal1, steal2), SHOP, Map.of(), -8))
                .isEqualTo(solve(steal2));
    }

    @Test
    void healsAtOneLife() {
        assertThat(decide(stats(1, 60), List.of(ad("s", "Piece of cake", 100)))).isEqualTo(buy(POTION));
    }

    @Test
    void noHealAtTwoLivesSolvesByValue() {
        Ad hmm = ad("m", "Hmmm....", 70);
        Ad risky = ad("r", "Risky", 60);
        assertThat(decide(stats(2, 120), List.of(risky, hmm))).isEqualTo(solve(hmm));
    }

    @Test
    void twoLivesNoSafeAdBuysAPlus2From350() {
        assertThat(decide(stats(2, 360), List.of(ad("m", "Quite likely", 100)))).isEqualTo(buy(CLAW_2));
    }

    @Test
    void twoLivesNoSafeAdBuysAPlus1From150() {
        assertThat(decide(stats(2, 200), List.of(ad("m", "Quite likely", 100)))).isEqualTo(buy(CLAW_1));
    }

    @Test
    void brokeAtThreeLivesSolvesTheSafestAd() {
        Ad gamble = ad("g", "Gamble", 500);
        Ad walk = ad("w", "Walk in the park", 30);
        assertThat(decide(stats(3, 30), List.of(gamble, walk))).isEqualTo(solve(walk));
    }

    @Test
    void safestIsLowestTierThenHighestRewardThenSoonestExpiry() {
        Ad cakeLate = ad("a", "Help a", "Piece of cake", 40, 5);
        Ad cakeSoon = ad("b", "Help b", "Sure thing", 40, 2);
        Ad cakeSmall = ad("c", "Help c", "Piece of cake", 10, 1);
        Ad unknown = ad("u", "Help u", "Brand new label", 900, 1);
        assertThat(decide(stats(3, 0), List.of(unknown, cakeSmall, cakeLate, cakeSoon))).isEqualTo(solve(cakeSoon));
        assertThat(decide(stats(3, 0), List.of(unknown))).isEqualTo(solve(unknown));
    }

    @Test
    void levelAtTwoLivesWithAModerateAdFrom400() {
        Ad safe = ad("s", "Sure thing", 30);
        Ad moderate = ad("m", "Walk in the park", 100);
        assertThat(decide(stats(2, 450), List.of(safe, moderate))).isEqualTo(buy(CLAW_2));
    }

    @Test
    void allSafeBoardSolvesWithoutBuying() {
        Ad small = ad("s1", "Piece of cake", 30);
        Ad big = ad("s2", "Sure thing", 80);
        assertThat(decide(stats(3, 5000), List.of(small, big))).isEqualTo(solve(big));
    }

    @Test
    void allDeadlyAt350BuysAPlus2() {
        List<Ad> board = List.of(ad("d1", "Playing with fire", 200), ad("d2", "Impossible", 900));
        assertThat(decide(stats(2, 360), board)).isEqualTo(buy(CLAW_2));
    }

    @Test
    void allDeadlyAt200BuysAPlus1() {
        List<Ad> board = List.of(ad("d1", "Playing with fire", 200), ad("d2", "Suicide mission", 900));
        assertThat(decide(stats(3, 200), board)).isEqualTo(buy(CLAW_1));
    }

    @Test
    void allDeadlyBelow150SolvesByValue() {
        Ad fire = ad("d1", "Playing with fire", 200);
        Ad suicide = ad("d2", "Suicide mission", 900);
        // 31×200 − 69×50 = 2750 against 6×900 − 94×50 = 700.
        assertThat(decide(stats(3, 120), List.of(suicide, fire))).isEqualTo(solve(fire));
    }

    @Test
    void brokeAtOneLifeSolvesTheSafestAd() {
        Ad risky = ad("r", "Risky", 400);
        Ad moderate = ad("m", "Quite likely", 50);
        assertThat(decide(stats(1, 20), List.of(risky, moderate))).isEqualTo(solve(moderate));
    }

    @Test
    void valuePrefersTheLikelierAdWhenTheLossPenaltyOutweighsTheReward() {
        // No safe ad, so lossCost = 50. 31×150 − 69×50 = 1200 against 63×70 − 37×50 = 2560.
        Ad fire = ad("f", "Playing with fire", 150);
        Ad hmm = ad("h", "Hmmm....", 70);
        assertThat(decide(stats(3, 100), List.of(fire, hmm))).isEqualTo(solve(hmm));
        assertThat(Strategy.value(fire, 50)).isEqualTo(1200);
        assertThat(Strategy.value(hmm, 50)).isEqualTo(2560);
    }

    @Test
    void valueFollowsTheFormulaEvenForALongShot() {
        // 31×200 − 69×50 = 2750 beats 63×70 − 37×50 = 2560 by the plan's formula.
        Ad fire = ad("f", "Playing with fire", 200);
        Ad hmm = ad("h", "Hmmm....", 70);
        assertThat(decide(stats(3, 100), List.of(hmm, fire))).isEqualTo(solve(fire));
    }

    @Test
    void lossCostsATurnValuedAtTheBestSafeReward() {
        // lossCost = 50 + 100: 72×150 − 28×150 = 6600 < 100×100 = 10000.
        Ad safe = ad("s", "Sure thing", 100);
        Ad likely = ad("l", "Quite likely", 150);
        assertThat(decide(stats(3, 100), List.of(likely, safe))).isEqualTo(solve(safe));
        assertThat(Strategy.value(likely, 150)).isEqualTo(6600);
    }

    @Test
    void valueTiesGoToHigherWinRateThenSoonerExpiry() {
        // No safe ad, so lossCost = 50: 87×22 − 13×50 = 1264 = 72×37 − 28×50.
        Ad walk = ad("w", "Help w", "Walk in the park", 22, 5);
        Ad likely = ad("l", "Help l", "Quite likely", 37, 1);
        assertThat(Strategy.value(walk, 50)).isEqualTo(Strategy.value(likely, 50));
        assertThat(decide(stats(3, 100), List.of(likely, walk))).isEqualTo(solve(walk));
        Ad walkSoon = ad("v", "Help v", "Walk in the park", 22, 2);
        assertThat(decide(stats(3, 100), List.of(likely, walk, walkSoon))).isEqualTo(solve(walkSoon));
    }

    @Test
    void rotationBuysTheLeastBoughtPlus2InShopOrder() {
        Ad moderate = ad("m", "Quite likely", 100);
        assertThat(Strategy.decide(stats(3, 1000), List.of(moderate), SHOP, Map.of("ch", 1), 0))
                .isEqualTo(buy(FIRE_2));
        assertThat(Strategy.decide(stats(3, 1000), List.of(moderate), SHOP, Map.of("ch", 1, "rf", 1), 0))
                .isEqualTo(buy(IRON_2));
    }

    @Test
    void emptyOrUnsolvableBoardHasNoMoveExceptHealing() {
        Ad undecodable = AdDecoder.decode("x", "y", "z", 10, 1, 9);
        assertThat(decide(stats(3, 1000), List.of(undecodable))).isEmpty();
        assertThat(decide(stats(2, 1000), List.of())).isEmpty();
        assertThat(decide(stats(1, 60), List.of())).isEqualTo(buy(POTION));
    }

    @Test
    void encryptedAdIsDecodedAndPlayed() {
        Ad decoded = AdDecoder.decode("vq", "Uryc", "Fher guvat", 30, 3, 2);
        Ad unknown = ad("u", "Brand new label", 9999);
        assertThat(decide(stats(3, 100), List.of(unknown, decoded))).isEqualTo(solve(decoded));
    }

    @Test
    void shopWithoutPotionOrLevelItemsStillSolves() {
        ShopItem mystery = new ShopItem("mystery", "Mystery", 1);
        Ad risky = ad("r", "Risky", 300);
        assertThat(Strategy.decide(stats(1, 1000), List.of(risky), List.of(mystery), Map.of(), 0))
                .isEqualTo(solve(risky));
    }

    @Test
    void shelfOrderIsCostThenApiOrder() {
        assertThat(Strategy.shelfOrder(SHOP)).containsExactly(POTION, CLAW_1, GAS_1, CLAW_2, FIRE_2, IRON_2);
    }
}
