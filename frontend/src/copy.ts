// Every player-facing string lives here, in tavern voice. Buttons state the plain action.
import type {
    GameError,
    ItemRecommendation,
    Reputation,
    RiskTier,
    StatKey,
    Urgency,
} from '@/game/types'

const livesWord = (n: number) => (n === 1 ? 'life' : 'lives')

/** The step 1 reason, on the Shop tab and on the potion's badge (CAP-17). */
const LOW_ON_LIVES = 'Low on lives'

/** Signed number with a true minus sign, e.g. "−2". */
const signed = (n: number) => (n < 0 ? `−${-n}` : String(n))

export const copy = {
    title: 'Dragons of Mugloar',
    /** Visually hidden, between the spoken parts of a control's name (job and shop rows, Shop tab). */
    separator: ', ',
    /** Units after a signed change (`formatDelta`). */
    units: {
        gold: () => 'gold',
        lives: livesWord,
        level: (n: number) => (n === 1 ? 'level' : 'levels'),
    } satisfies Record<'gold' | 'lives' | 'level', (n: number) => string>,
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
        /** The Shop link's one hint (CAP-17), after a visually hidden separator. */
        hint: {
            'low-lives': LOW_ON_LIVES,
            'level-up': 'Level up',
        } satisfies Record<ItemRecommendation['reason'], string>,
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
        unsolvable:
            'This notice is written in a code the barman cannot read, so it cannot be solved.',
    },
    jobs: {
        /** Visually hidden, before the list: how it is ordered. */
        listIntro: 'Best jobs first.',
        unknownOdds: 'unknown odds',
        /** Visible win rate next to the label, e.g. "87%". */
        winPct: (n: number) => `${n}%`,
        bestPick: 'Best pick',
        trap: 'Trap',
        stateRisk: 'Angers the state',
        /*
         * Visually hidden parts of a row's accessible name, which the row's content forms, e.g.
         * "Solve: 340 gold, safe, Piece of cake, 95%, Best pick. Escort the mayor. 2 turns left,
         * soon".
         */
        solve: 'Solve: ',
        tier: {
            safe: 'safe, ',
            moderate: 'moderate, ',
            risky: 'risky, ',
            deadly: 'deadly, ',
            unknown: 'unknown risk, ',
        } satisfies Record<RiskTier, string>,
        endOdds: '. ',
        endMessage: '. ',
        gold: ' gold',
        turnsLeft: (n: number) => (n === 1 ? ' turn left' : ' turns left'),
        /** After the turns left, so urgency is never conveyed by colour alone (AD-15). */
        urgency: {
            critical: ', expiring',
            soon: ', soon',
            normal: '',
        } satisfies Record<Urgency, string>,
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
        flavour: 'Wares for your dragon, cheapest on the top shelf. Pay at the counter.',
        /** The recommended item's badge, by the recommendation's reason. */
        badge: {
            'low-lives': LOW_ON_LIVES,
            'level-up': 'Buy next',
        } satisfies Record<ItemRecommendation['reason'], string>,
        /** The badge on every +1 item. */
        notWorth: 'Not worth it',
        /** Visible owned count, e.g. "Owned ×2"; spoken as "owned 2". */
        owned: (n: number) => `Owned ×${n}`,
        ownedSpoken: (n: number) => `owned ${n}`,
        /*
         * Visually hidden parts of a row's name, e.g.
         * "Rocket Fuel, +2 levels, 300 gold, Buy next, buy (costs one turn)".
         */
        gold: ' gold',
        /** The visible cue that the row buys; the name ends with `buySpoken` instead. */
        buy: 'Buy',
        buySpoken: 'buy (costs one turn)',
        shortfall: (n: number) => `You need ${n} more gold.`,
        /** The bought row's status after a failed buy (a failed buy still costs a turn [V]). */
        buyFailed: 'The shopkeeper fumbled the sale. Nothing was bought.',
        /** The bought row's status when the buy raised no stat. */
        boughtNoChange: 'Bought, though your dragon looks much the same.',
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
    credits: 'Icons: Lorc, Delapouite, Sbed, Skoll (game-icons.net, CC BY 3.0)',
}

export function errorMessage(error: GameError): string {
    if (error.kind === 'network') {
        return copy.errors.network
    }
    if (error.kind === 'not-found') {
        return copy.errors.notFound
    }
    return copy.errors.http
}

/**
 * A signed change with its unit, e.g. "+82 gold", "−1 life", "+2 levels". The log shows gold
 * and lives, plus level for buys (CAP-12); the shop shows item effects and buy results (CAP-4).
 */
export function formatDelta(key: keyof typeof copy.units, value: number): string {
    const size = Math.abs(value)
    return `${value > 0 ? '+' : '−'}${size} ${copy.units[key](size)}`
}

/** CAP-5: the three values; `null` means unknown until first investigated. */
export function reputationRows(
    rep: Reputation | null,
): { key: keyof Reputation; label: string; value: number | null }[] {
    const keys: (keyof Reputation)[] = ['people', 'state', 'underworld']
    return keys.map((key) => ({ key, label: copy.reputation[key], value: rep?.[key] ?? null }))
}
