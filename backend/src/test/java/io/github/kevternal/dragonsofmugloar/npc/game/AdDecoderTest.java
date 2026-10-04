package io.github.kevternal.dragonsofmugloar.npc.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Test;

class AdDecoderTest {

    private static String b64(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void plainAdPassesThroughSolvable() {
        Ad ad = AdDecoder.decode("id1", "Help", "Sure thing", 50, 3, null);
        assertThat(ad).isEqualTo(new Ad("id1", "Help", 50, 3, "Sure thing", true));
    }

    @Test
    void base64AdIsDecoded() {
        Ad ad = AdDecoder.decode(b64("id2"), b64("Défendre"), b64("Piece of cake"), 10, 1, 1);
        assertThat(ad).isEqualTo(new Ad("id2", "Défendre", 10, 1, "Piece of cake", true));
    }

    @Test
    void rot13AdIsDecoded() {
        Ad ad = AdDecoder.decode("vq3", "Uryc gur ivyyntr", "Fher guvat", 7, 2, 2);
        assertThat(ad).isEqualTo(new Ad("id3", "Help the village", 7, 2, "Sure thing", true));
    }

    @Test
    void unknownEncryptionKeepsRawFieldsAndIsUnsolvable() {
        Ad ad = AdDecoder.decode("xx", "??", "Piece of cake", 5, 1, 3);
        assertThat(ad).isEqualTo(new Ad("xx", "??", 5, 1, "Piece of cake", false));
        assertThat(Risk.riskTier(ad)).isEqualTo(Risk.Tier.UNKNOWN);
    }

    @Test
    void undecodableBase64IsUnsolvableNotDropped() {
        Ad ad = AdDecoder.decode("***", "***", "***", 5, 1, 1);
        assertThat(ad.solvable()).isFalse();
        assertThat(ad.adId()).isEqualTo("***");
    }
}
