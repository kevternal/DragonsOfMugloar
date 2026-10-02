// Raw response shapes as the live API sends them (api-contract.md).

export interface StartDto {
    gameId: string
    lives: number
    gold: number
    level: number
    score: number
    highScore: number
    turn: number
}

export interface AdDto {
    adId: string
    message: string
    reward: number
    expiresIn: number
    encrypted: number | null
    probability: string
}

export interface SolveDto {
    success: boolean
    lives: number
    gold: number
    score: number
    highScore: number
    turn: number
    message: string
}

export interface ItemDto {
    id: string
    name: string
    cost: number
}

export interface BuyDto {
    shoppingSuccess: boolean
    gold: number
    lives: number
    level: number
    turn: number
}

export interface ReputationDto {
    people: number
    state: number
    underworld: number
}
