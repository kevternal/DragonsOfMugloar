// Every player-facing string lives here, in tavern voice. Buttons state the plain action.
import type { GameError, Reputation, StatKey } from '@/game/types'

const livesWord = (n: number) => (n === 1 ? 'life' : 'lives')

/** Signed number with a true minus sign, e.g. "−2". */
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n))

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
        unknownShort: '?',
    } satisfies Record<StatKey | 'heading' | 'unknown' | 'unknownShort', string>,
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
        effectLife: (n: number) => `Restores ${n} ${livesWord(n)}`,
        shortfall: (n: number) => `You need ${n} more gold.`,
    },
    reputation: {
        label: 'Reputation',
        button: 'Investigate reputation (costs one turn)',
        people: 'People',
        state: 'State',
        underworld: 'Underworld',
    },
    log: {
        label: 'Activity',
        none: 'Nothing has happened yet.',
        // The visual text is short; the visually hidden text carries separators for speech.
        turn: (n: number | null) => (n === null ? 'T?' : `T${n}`),
        turnSpoken: (n: number | null) => (n === null ? 'Turn unknown, ' : `Turn ${n}, `),
        markOk: '✓',
        markFail: '✗',
        succeeded: 'succeeded: ',
        failed: 'failed: ',
        deltasSpoken: ', ',
        bought: (item: string) => `Bought ${item}`,
        asked: (rep: Reputation) =>
            `Asked around: people ${signed(rep.people)}, state ${signed(rep.state)}, underworld ${signed(rep.underworld)}`,
        units: { gold: () => 'gold', lives: livesWord } satisfies Record<
            'gold' | 'lives',
            (n: number) => string
        >,
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
    credits: 'A Dragons of Mugloar client.',
}

export function errorMessage(error: GameError): string {
    if (error.kind === 'network') return copy.errors.network
    if (error.kind === 'not-found') return copy.errors.notFound
    return copy.errors.http
}

/** CAP-12: the log shows only non-zero gold and lives changes, e.g. "+82 gold", "−1 life". */
export function formatDelta(key: 'gold' | 'lives', value: number): string {
    const size = Math.abs(value)
    return `${value > 0 ? '+' : '−'}${size} ${copy.log.units[key](size)}`
}

/** CAP-5: the three values; `null` means unknown until first investigated. */
export function reputationRows(rep: Reputation | null): { label: string; value: number | null }[] {
    const values = rep === null ? null : [rep.people, rep.state, rep.underworld]
    return [copy.reputation.people, copy.reputation.state, copy.reputation.underworld].map(
        (label, i) => ({ label, value: values?.[i] ?? null }),
    )
}
