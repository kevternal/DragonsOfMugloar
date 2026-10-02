import { vi } from 'vitest'

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
            if (!handler) throw new Error(`No stub for ${key}`)
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
export const startBody = (gameId: string) => ({
    gameId,
    lives: 3,
    gold: 0,
    level: 0,
    score: 0,
    highScore: 0,
    turn: 0,
})
