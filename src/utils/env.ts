export function isDevelopment(): boolean {
    return typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development';
}
