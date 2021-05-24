/* eslint-disable @typescript-eslint/no-var-requires */

import { deepEquals } from '@noeldemartin/utils';
import { installJestPlugin } from '@noeldemartin/solid-utils';

import flattenJsonLD from '@/solid/utils/flattenJsonLD';
import { bootSolidModels } from '@/models';

installJestPlugin();
beforeEach(() => jest.clearAllMocks());
beforeEach(() => bootSolidModels());

process.on('unhandledRejection', (err) => fail(err));

expect.extend({

    async toEqualJsonLD(received, expected) {
        const diff = require('jest-diff');
        const [flatReceived, flatExpected] = await Promise.all([
            flattenJsonLD(received),
            flattenJsonLD(expected),
        ]);
        const pass = deepEquals(flatReceived, flatExpected);
        const message = pass
            ? () =>
                this.utils.matcherHint('toEqualJsonLD') +
                    '\n\n' +
                    `Expected: not ${this.utils.printExpected(flatExpected)}\n` +
                    `Received: ${this.utils.printReceived(flatReceived)}`
            : () => {
                const diffString = diff(flatExpected, flatReceived, {
                    expand: this.expand,
                });
                return (
                    this.utils.matcherHint('toEqualJsonLD') +
                    '\n\n' +
                    (diffString && diffString.includes('- Expect')
                        ? `Difference:\n\n${diffString}`
                        : `Expected: ${this.utils.printExpected(flatExpected)}\n` +
                        `Received: ${this.utils.printReceived(flatReceived)}`)
                );
            };

        return {
            actual: flatReceived,
            message,
            pass,
        };
    },

    async toEqualSPARQL(received, expected) {
        const diff = require('jest-diff');
        const normalizeQuery = (query: string) => query.trim().replace(/\s+/g, ' ');
        const normalizedReceived = normalizeQuery(received);
        const normalizedExpected = normalizeQuery(expected);
        const pass = normalizedReceived === normalizedExpected;
        const message = pass
            ? () =>
                this.utils.matcherHint('toEqualSPARQL') +
                    '\n\n' +
                    `Expected: not ${this.utils.printExpected(normalizedExpected)}\n` +
                    `Received: ${this.utils.printReceived(normalizedReceived)}`
            : () => {
                const diffString = diff(normalizedExpected, normalizedReceived, {
                    expand: this.expand,
                });
                return (
                    this.utils.matcherHint('toEqualSPARQL') +
                    '\n\n' +
                    (diffString && diffString.includes('- Expect')
                        ? `Difference:\n\n${diffString}`
                        : `Expected: ${this.utils.printExpected(normalizedExpected)}\n` +
                        `Received: ${this.utils.printReceived(normalizedReceived)}`)
                );
            };

        return {
            actual: received,
            message,
            pass,
        };
    },

});
