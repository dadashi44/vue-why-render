const DEFAULT_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function isAllowedOrigin(origin: string | undefined, extra: string[]): boolean {
    if (!origin) return false
    let url: URL
    try {
        url = new URL(origin)
    } catch {
        return false
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (DEFAULT_HOSTS.has(host) || host.endsWith('.localhost')) return true
    return extra.some(e => e.trim().toLowerCase() === host)
}
