import type { VitestSolidMatchers } from '@noeldemartin/solid-utils/testing';

declare module 'vitest' {
    interface Assertion<T> extends VitestSolidMatchers<T> {}
    interface AsymmetricMatchersContaining extends VitestSolidMatchers {}
}
