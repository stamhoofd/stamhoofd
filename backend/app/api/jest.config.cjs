const useGithubActions = !!process.env.GITHUB_ACTIONS;

module.exports = {
    roots: ['<rootDir>/dist'],
    testEnvironment: 'node',
    setupFilesAfterEnv: [
        'jest-extended/all',
        './dist/tests/jest.setup.js',
    ],
    reporters: [['jest-console-group-reporter', {
        consoleLevels: ['error', 'warn'],
        filters: [],
        groups: [],
        onlyFailingTestSuites: true,
        afterEachTest: {
            enable: false,
        },
        afterAllTests: {
            reportType: 'detailed',
            enable: true,
            filePaths: true,
        },
        useGitHubActions: useGithubActions,
    }]],
    globalSetup: './dist/tests/jest.global.setup.js',
    // verbose: true,
};
