package io.github.kevternal.dragonsofmugloar.npc.game;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/** AD-3: the only place encrypted ads are decoded. Ported from the frontend's {@code decodeAd}. */
public final class AdDecoder {

    private AdDecoder() {
    }

    /**
     * {@code encrypted} null is plain text, 1 is base64 and 2 is ROT13 of adId, message and
     * probability [V]. Any other value, or an undecodable payload, keeps the raw fields with
     * {@code solvable=false}; the ad is never dropped.
     */
    public static Ad decode(String adId, String message, String probability, int reward, int expiresIn,
                            Integer encrypted) {
        if (encrypted == null) {
            return new Ad(adId, message, reward, expiresIn, probability, true);
        }
        try {
            switch (encrypted) {
                case 1 -> {
                    return new Ad(base64(adId), base64(message), reward, expiresIn, base64(probability), true);
                }
                case 2 -> {
                    return new Ad(rot13(adId), rot13(message), reward, expiresIn, rot13(probability), true);
                }
                default -> {
                    // Fall through to the unsolvable ad below.
                }
            }
        } catch (IllegalArgumentException e) {
            // Undecodable base64: fall through to the unsolvable ad below.
        }
        return new Ad(adId, message, reward, expiresIn, probability, false);
    }

    // Whether the base64 payload is always UTF-8 is [U].
    static String base64(String text) {
        return new String(Base64.getDecoder().decode(text), StandardCharsets.UTF_8);
    }

    static String rot13(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (char c : text.toCharArray()) {
            if (c >= 'a' && c <= 'z') {
                out.append((char) ('a' + (c - 'a' + 13) % 26));
            } else if (c >= 'A' && c <= 'Z') {
                out.append((char) ('A' + (c - 'A' + 13) % 26));
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }
}
