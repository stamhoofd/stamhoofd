module.exports = {
    setupFilesAfterEnv: [
        "jest-extended/all",
    ],
    testEnvironment: "node",
    preset: 'ts-jest',
    testTimeout: 10 * 1000,
    roots: [
        './src/'
    ],
    transform: {
        '\\.[t]s?$': [
            'ts-jest',
            {
                useESM: true
            }
        ]
    },
    moduleNameMapper: {
        '(.+)\\.js': '$1'
    },
    extensionsToTreatAsEsm: [
        '.ts'
    ]
};
