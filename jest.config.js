module.exports = {
    testRegex: '\\.test\\.ts$',
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        '<rootDir>/src/**/*',
    ],
    coveragePathIgnorePatterns: [
        '<rootDir>/src/types/',
        '<rootDir>/src/index\.ts',
    ],
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
    setupFilesAfterEnv: [
        '<rootDir>/tests/setup.ts',
    ],
};
