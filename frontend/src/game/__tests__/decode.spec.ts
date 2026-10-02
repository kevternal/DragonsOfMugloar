import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdDto } from '@/api/types'
import { decodeAd } from '../decode'

const base: AdDto = {
    adId: 'abc123',
    message: 'Steal the hat',
    reward: 40,
    expiresIn: 3,
    encrypted: null,
    probability: 'Sure thing',
}

describe('decodeAd', () => {
    afterEach(() => vi.restoreAllMocks())

    it('passes plain ads through as solvable', () => {
        expect(decodeAd(base)).toEqual({
            adId: 'abc123',
            message: 'Steal the hat',
            reward: 40,
            expiresIn: 3,
            probability: 'Sure thing',
            solvable: true,
        })
    })

    it('decodes base64 (encrypted 1), including UTF-8', () => {
        const enc = (text: string) => btoa(String.fromCodePoint(...new TextEncoder().encode(text)))
        const ad = decodeAd({
            ...base,
            encrypted: 1,
            adId: enc('abc123'),
            message: enc('Rescue the café'),
            probability: enc('Piece of cake'),
        })
        expect(ad).toMatchObject({
            adId: 'abc123',
            message: 'Rescue the café',
            probability: 'Piece of cake',
            solvable: true,
        })
    })

    it('decodes ROT13 (encrypted 2)', () => {
        const ad = decodeAd({
            ...base,
            encrypted: 2,
            adId: 'nop123',
            message: 'Fgrny',
            probability: 'Fher guvat',
        })
        expect(ad).toMatchObject({
            adId: 'abc123',
            message: 'Steal',
            probability: 'Sure thing',
            solvable: true,
        })
    })

    it('keeps an unlisted scheme, marks it unsolvable, and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const ad = decodeAd({ ...base, encrypted: 7 })
        expect(ad).toMatchObject({ adId: 'abc123', message: 'Steal the hat', solvable: false })
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ad.encrypted'))
    })

    it('does not throw on an undecodable base64 payload', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        expect(decodeAd({ ...base, encrypted: 1, adId: '***' }).solvable).toBe(false)
    })
})
