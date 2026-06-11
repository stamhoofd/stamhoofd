import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    globalSetup: './src/setup/global-setup.js',
    globalTeardown: './src/setup/global-teardown.js',
    testDir: './src/tests',
    /* Exclude tests tagged @extra unless explicitly requested via PLAYWRIGHT_INCLUDE_EXTRA env var */
    grepInvert: process.env.PLAYWRIGHT_INCLUDE_EXTRA ? undefined : /@extra/,
    /* Run tests in files in parallel */
    fullyParallel: true, // Keeping this false decreases the difference between CI and local running
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 2 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'line',

    // Suppress logs in tests
    quiet: process.env.CI ? false : true,

    build: {
        // Disable buggy transpilation we don't need
        // this tries to transpile sources,
        external: [import.meta.resolve('../../../').replace('file://', '/') + '/backend/**', import.meta.resolve('../../../').replace('file://', '/') + '/shared/**'],
    },

    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('')`. */
        // baseURL: 'http://localhost:3000',

        // Capture screenshot after each test failure.
        screenshot: 'only-on-failure',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',

        // todo
        headless: process.env.HEADED ? false : true,
        // ignoreHTTPSErrors: true,
        launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-position=2721,66'],
        },
        navigationTimeout: process.env.CI ? 30_000 : 10_000,
        actionTimeout: process.env.CI ? 30_000 : 10_000,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                channel: 'chromium',
            },
        },
    ],
});
