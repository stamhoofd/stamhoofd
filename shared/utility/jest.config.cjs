module.exports = {
    setupFilesAfterEnv: [
        'jest-extended/all',
    ],
    testEnvironment: 'node',
    preset: 'ts-jest',
    testTimeout: 10 * 1000,
    roots: [
        './src/',
    ],
    transform: {
        '\\.ts?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.test.json',
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
