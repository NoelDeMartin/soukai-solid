function getEnv(): string | null {
    if (typeof globalThis === 'object' && 'Cypress' in globalThis) {
        return 'testing';
    }

    if (typeof window === 'object' && '$app' in window && !!window.$app?.environment) {
        return window.$app.environment;
    }

    if (typeof process === 'object' && process.env) {
        if (process.env.VITEST) {
            return 'testing';
        }

        if (process.env.NODE_ENV) {
            return process.env.NODE_ENV;
        }
    }

    return null;
}
export function applyStrictChecks(): boolean {
    const env = getEnv();

    return env === 'development' || env === 'testing';
}
