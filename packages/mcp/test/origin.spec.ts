import { describe, expect, it } from 'vitest'
import { isAllowedOrigin } from '../src/origin.js'

describe('isAllowedOrigin', () => {
    it('allows localhost variants', () => {
        expect(isAllowedOrigin('http://localhost:5173', [])).toBe(true)
        expect(isAllowedOrigin('http://127.0.0.1:3000', [])).toBe(true)
        expect(isAllowedOrigin('http://[::1]:5173', [])).toBe(true)
        expect(isAllowedOrigin('http://app.localhost', [])).toBe(true)
        expect(isAllowedOrigin('https://app.localhost:8443', [])).toBe(true)
    })
    it('rejects foreign, missing and garbage origins', () => {
        expect(isAllowedOrigin('https://evil.com', [])).toBe(false)
        expect(isAllowedOrigin('https://localhost.evil.com', [])).toBe(false)
        expect(isAllowedOrigin(undefined, [])).toBe(false)
        expect(isAllowedOrigin('not a url', [])).toBe(false)
        expect(isAllowedOrigin('ftp://localhost', [])).toBe(false)
    })
    it('honors extra hosts', () => {
        expect(isAllowedOrigin('http://myapp.test', [])).toBe(false)
        expect(isAllowedOrigin('http://myapp.test:8080', ['myapp.test'])).toBe(true)
    })
})
