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

/** jsdom has no ResizeObserver. This stub reports each observed element once, at once. */
class ResizeObserverStub {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element): void {
        this.callback([{ target } as ResizeObserverEntry], this)
    }
    unobserve(): void {}
    disconnect(): void {}
}

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})
