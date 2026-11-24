// The CLI bundles shared code from src/core, which reads Vue's version at
// runtime. The MCP server never runs inside the app, so Vue is aliased to
// this stub at build time.
export const version = 'unknown'
export const isRef = (): boolean => false
export const toRaw = <T>(value: T): T => value
