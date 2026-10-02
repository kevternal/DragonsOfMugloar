import type { AdDto } from '@/api/types'
import type { Ad } from './types'
import { warnUnlisted } from './warn'

function rot13(text: string): string {
    return text.replace(/[a-z]/gi, (char) => {
        const base = char <= 'Z' ? 65 : 97
        return String.fromCodePoint((((char.codePointAt(0) ?? 0) - base + 13) % 26) + base)
    })
}

// Whether the base64 payload is always UTF-8 is [U] (architecture, Open Questions).
function base64(text: string): string {
    const binary = atob(text)
    const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0)
    return new TextDecoder().decode(bytes)
}

const DECODERS: Record<number, (text: string) => string> = { 1: base64, 2: rot13 }

/** AD-3: the only place encrypted ads are decoded. */
export function decodeAd(dto: AdDto): Ad {
    const { adId, message, probability, reward, expiresIn, encrypted } = dto
    if (encrypted === null || encrypted === undefined) {
        return { adId, message, probability, reward, expiresIn, solvable: true }
    }
    const decode = DECODERS[encrypted]
    if (decode) {
        try {
            return {
                adId: decode(adId),
                message: decode(message),
                probability: decode(probability),
                reward,
                expiresIn,
                solvable: true,
            }
        } catch {
            warnUnlisted('encrypted payload (undecodable)', encrypted)
        }
    } else {
        warnUnlisted('Ad.encrypted', encrypted)
    }
    return { adId, message, probability, reward, expiresIn, solvable: false }
}
