// Every player-facing string lives here, in tavern voice. Buttons state the plain action.
import type { GameError, Reputation, StatKey } from '@/game/types'

export const copy = {
    title: 'Dragons of Mugloar',
    start: {
        heading: 'Dragons of Mugloar',
        intro: 'Pull up a stool. The board is full of work, and your dragon is hungry.',
        button: 'Start game',
        starting: 'Starting game...',
        expired: 'This game has gone cold. The tavern shut its doors on it, so start a new one.',
    },
    nav: {
        label: 'Game sections',
        ads: 'Message board',
        shop: 'Shop',
    },
    stats: {
        heading: 'Your dragon',
        lives: 'Lives',
        gold: 'Gold',
        level: 'Level',
        score: 'Score',
        turn: 'Turn',
        unknown: 'unknown',
    } satisfies Record<StatKey | 'heading' | 'unknown', string>,
    ads: {
        heading: 'Message board',
        empty: 'The board is bare. Nothing is posted right now.',
        reward: 'Reward',
        expiresIn: 'Expires in',
        probability: 'Chance',
        solve: 'Solve',
        unsolvable:
            'This notice is written in a code the barman cannot read, so it cannot be solved.',
    },
    board: {
        notice: 'The barman went to put up new posters. Come back later, or have a beer.',
        retry: 'Check the board again',
        refreshing: 'The barman is checking the board...',
    },
    shop: {
        heading: 'Shop',
        empty: 'The shelves are empty. Nothing is for sale right now.',
        failed: 'The shopkeeper is out back and could not show his wares. Have a look again in a moment.',
        retry: 'Check the shop again',
        cost: 'Cost',
        buy: 'Buy',
        effectLevel: (n: number) => `Raises your dragon's level by ${n}`,
        effectLife: (n: number) => `Restores ${n} ${n === 1 ? 'life' : 'lives'}`,
        shortfall: (n: number) => `You need ${n} more gold.`,
    },
    reputation: {
        heading: 'Reputation',
        button: 'Investigate reputation (costs one turn)',
        people: 'People',
        state: 'State',
        underworld: 'Underworld',
        none: 'You have not asked around yet.',
    },
    lastTurn: {
        heading: 'Last turn',
        none: 'Nothing has happened yet.',
        solved: (ad: string) => `You took the job: ${ad}`,
        bought: (item: string) => `You bought: ${item}`,
        boughtOk: 'The purchase went through.',
        boughtFail: 'The purchase failed.',
        asked: 'You asked around about your reputation.',
        success: 'Success',
        failure: 'Failure',
        changes: 'Changes',
        noChanges: 'No changes to show.',
        deltaLabels: {
            lives: 'lives',
            gold: 'gold',
            score: 'score',
            level: 'level',
            turn: 'turn',
        } satisfies Record<StatKey, string>,
    },
    over: {
        heading: 'Game over',
        message: 'Your dragon has fallen. The tavern raises a mug to it.',
        finalScore: 'Final score',
        finalTurn: 'Turn reached',
        playAgain: 'Play again',
        starting: 'Starting game...',
    },
    errors: {
        network: 'The messenger got lost on the road. Check your connection and try again.',
        http: 'The tavern is in an uproar and could not answer. Try again in a moment.',
        notFound: 'That one is gone from the board. The board has been checked again.',
    },
    loading: 'Fetching your game...',
    footer: 'A Dragons of Mugloar client.',
}

export function errorMessage(error: GameError): string {
    if (error.kind === 'network') return copy.errors.network
    if (error.kind === 'not-found') return copy.errors.notFound
    return copy.errors.http
}

export function formatDelta(key: StatKey, value: number): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    return `${sign}${Math.abs(value)} ${copy.lastTurn.deltaLabels[key]}`
}

export function reputationRows(rep: Reputation): { label: string; value: number }[] {
    return [
        { label: copy.reputation.people, value: rep.people },
        { label: copy.reputation.state, value: rep.state },
        { label: copy.reputation.underworld, value: rep.underworld },
    ]
}
