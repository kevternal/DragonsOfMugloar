import { vi } from 'vitest'
import type { ShopItem } from '@/game/types'

export const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status })
export const html404 = () => new Response('<html>Not Found</html>', { status: 404 })

/** Routes fetch calls by "METHOD path" and records every call. */
export function stubApi(routes: Record<string, () => Response | Promise<Response>>): string[] {
    const calls: string[] = []
    vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>((input, init) => {
            const url = String(input).replace('https://dragonsofmugloar.com/api/v2', '')
            const key = `${init?.method ?? 'GET'} ${url}`
            calls.push(key)
            const handler = routes[key]
            if (!handler) {
                throw new Error(`No stub for ${key}`)
            }
            return Promise.resolve(handler())
        }),
    )
    return calls
}

export const ads = [
    {
        adId: 'a1',
        message: 'Job one',
        reward: 10,
        expiresIn: 2,
        encrypted: null,
        probability: 'Sure thing',
    },
]
export const items = [{ id: 'hpot', name: 'Healing potion', cost: 50 }]

/** The live shop, in API order (observed-values.md, "Shop items" [V]). */
export const LIVE_SHOP: readonly ShopItem[] = [
    { id: 'hpot', name: 'Healing potion', cost: 50 },
    { id: 'cs', name: 'Claw Sharpening', cost: 100 },
    { id: 'gas', name: 'Gasoline', cost: 100 },
    { id: 'wax', name: 'Copper Plating', cost: 100 },
    { id: 'tricks', name: 'Book of Tricks', cost: 100 },
    { id: 'wingpot', name: 'Potion of Stronger Wings', cost: 100 },
    { id: 'ch', name: 'Claw Honing', cost: 300 },
    { id: 'rf', name: 'Rocket Fuel', cost: 300 },
    { id: 'iron', name: 'Iron Plating', cost: 300 },
    { id: 'mtrix', name: 'Book of Megatricks', cost: 300 },
    { id: 'wingpotmax', name: 'Potion of Awesome Wings', cost: 300 },
]

/** The live shop item with this id. */
export function liveItem(id: string): ShopItem {
    const item = LIVE_SHOP.find((i) => i.id === id)
    if (!item) {
        throw new Error(`No live item ${id}`)
    }
    return { ...item }
}
export const startBody = (gameId: string) => ({
    gameId,
    lives: 3,
    gold: 0,
    level: 0,
    score: 0,
    highScore: 0,
    turn: 0,
})
