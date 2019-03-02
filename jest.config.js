module.exports = {
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    testRegex: '\\.test\\.ts$',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '^@mocks/(.*)$': '<rootDir>/tests/__mocks__/$1',
    },
    moduleFileExtensions: [
        'ts',
        'js',
        'json',
        'node',
    ],
};
