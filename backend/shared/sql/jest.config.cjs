module.exports = {
    setupFilesAfterEnv: [
        'jest-extended/all',
        './tests/jest.setup.ts',
    ],
    globalSetup: './tests/jest.global.setup.ts',
    testEnvironment: 'node',
    preset: 'ts-jest',
    testTimeout: 10 * 1000,
    roots: [
        './src/',
        './tests/',
    ],
    transform: {
        '\\.ts?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    moduleNameMapper: {
        '(.+)\\.js': '$1',
    },
    extensionsToTreatAsEsm: [
        '.ts',
    ],
};
