import { describe, expect, it, vi } from 'vitest'
import { ApiError, getMessages } from '../client'

describe('api client errors', () => {
    it('maps a rejected fetch to a network ApiError', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
        await expect(getMessages('g1')).rejects.toMatchObject({ kind: 'network', status: null })
        await expect(getMessages('g1')).rejects.toBeInstanceOf(ApiError)
    })

    it('maps a 200 with an unparseable body to an http ApiError', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 200 })),
        )
        await expect(getMessages('g1')).rejects.toMatchObject({ kind: 'http', status: 200 })
    })

    it('maps 404 to not-found without parsing the body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 404 })))
        await expect(getMessages('g1')).rejects.toMatchObject({ kind: 'not-found', status: 404 })
    })
})
