import { beforeEach, vi } from 'vitest'

// AD-16: tests never reach the live API. Tests override this stub per case.
beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(() => {
            throw new Error('Unstubbed fetch in test')
        }),
    )
})
