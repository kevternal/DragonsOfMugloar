import type { AdDto, BuyDto, ItemDto, ReputationDto, SolveDto, StartDto } from './types'

export const BASE_URL = 'https://dragonsofmugloar.com/api/v2'

export class ApiError extends Error {
    readonly status: number | null
    readonly kind: 'not-found' | 'network' | 'http'

    constructor(kind: 'not-found' | 'network' | 'http', status: number | null) {
        super(`API ${kind}${status === null ? '' : ` ${status}`}`)
        this.name = 'ApiError'
        this.kind = kind
        this.status = status
    }
}

// Non-2xx bodies are never parsed: the live API sends HTML for errors [V 2026-10-01].
async function request<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
    let response: Response
    try {
        response = await fetch(`${BASE_URL}${path}`, { method })
    } catch {
        throw new ApiError('network', null)
    }
    if (!response.ok) {
        throw new ApiError(response.status === 404 ? 'not-found' : 'http', response.status)
    }
    try {
        return (await response.json()) as T
    } catch {
        throw new ApiError('http', response.status)
    }
}

const seg = encodeURIComponent

export const startGame = () => request<StartDto>('/game/start', 'POST')
export const getMessages = (gameId: string) => request<AdDto[]>(`/${seg(gameId)}/messages`, 'GET')
export const solveAd = (gameId: string, adId: string) =>
    request<SolveDto>(`/${seg(gameId)}/solve/${seg(adId)}`, 'POST')
export const getShop = (gameId: string) => request<ItemDto[]>(`/${seg(gameId)}/shop`, 'GET')
export const buyItem = (gameId: string, itemId: string) =>
    request<BuyDto>(`/${seg(gameId)}/shop/buy/${seg(itemId)}`, 'POST')
export const investigateReputation = (gameId: string) =>
    request<ReputationDto>(`/${seg(gameId)}/investigate/reputation`, 'POST')
