
export function toString(value: unknown): string {
    return value + '';
}

export function isObject(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null;
}
