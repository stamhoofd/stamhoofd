import { TestHelper } from "@stamhoofd/test-utils";

/**
 * Custom implementation of TestHelper methods. This helper gets injected in TestUtils.
 *
 * HOOKS
 * Problem:
 * The test hooks (beforeAll, afterAll, beforeEach, afterEach) can only be called in a test file. This should require the TestUtils to be setup in each test file which is code repitition and extra complexity. Also this throws errors because of the way Playwright works.
 *
 * Solution:
 * An alternative approach (according to oficial documentation) is to execute a function in the fixtures. Therefore this class is used as a workaround. The execute methods are automatically called on the right moment in the fixtures (before all and after all in a worker scoped fixture, before each and after each in a test scoped fixture).
 *
 * ENVIRONMENT
 * Problem 1:
 * The environment depends on the worker index, therefore the environment cannot be read from a file.
 *
 * Solution 1:
 * The environment is set in the PlaywrightTestUtilsHelperInstance after the environment is loaded. Now this default environment is loaded every time the environment is loaded.
 *
 * Problem 2:
 * The frontend environment is exposed and has to be set also. TestUtils only sets the shared environment on STAMHOOFD.
 *
 * Solution 2:
 * With the afterSetEnvironment hook the exposed frontend environment will be set also.
 */
export class PlaywrightTestUtilsHelperInstance implements TestHelper {
    private environment: string | null = null;

    setDefaultEnvironment(environment: typeof STAMHOOFD) {
        this.environment = JSON.stringify(environment);
    }

    afterSetEnvironment<Key extends keyof SharedEnvironment>(
        value: Key,
        newValue: SharedEnvironment[Key],
    ): void {
        STAMHOOFD.EXPOSE_FRONTEND_ENVIRONMENT[value] =
            newValue as FrontendEnvironment[Key];
    }

    async loadEnvironment(): Promise<void> {
        if (this.environment === null) {
            throw new Error("Environment not set.");
        }

        let globalObject: any = null;

        if (typeof global === "object") {
            globalObject = global;
        }

        if (typeof self === "object") {
            globalObject = self;
        }

        (globalObject as any).STAMHOOFD = JSON.parse(this.environment);
    }

    private beforeAllCallback: (() => void | Promise<void>) | null = null;
    beforeAll(callback: () => void | Promise<void>) {
        this.beforeAllCallback = callback;
    }

    async executeBeforeAll() {
        if (this.beforeAllCallback !== null) {
            await this.beforeAllCallback();
        } else {
            console.warn("No beforeAll callback set.");
        }
    }

    private afterAllCallback: (() => void | Promise<void>) | null = null;
    afterAll(callback: () => void | Promise<void>) {
        this.afterAllCallback = callback;
    }

    async executeAfterAll() {
        if (this.afterAllCallback !== null) {
            await this.afterAllCallback();
        } else {
            console.warn("No afterAll callback set.");
        }
    }

    private beforeEachCallback: (() => void | Promise<void>) | null = null;
    beforeEach(callback: () => void | Promise<void>) {
        this.beforeEachCallback = callback;
    }

    async executeBeforeEach() {
        if (this.beforeEachCallback !== null) {
            await this.beforeEachCallback();
        } else {
            console.warn("No beforeEach callback set.");
        }
    }

    private afterEachCallback: (() => void | Promise<void>) | null = null;
    afterEach(callback: () => void | Promise<void>) {
        this.afterEachCallback = callback;
    }

    async executeAfterEach() {
        if (this.afterEachCallback !== null) {
            await this.afterEachCallback();
        } else {
            console.warn("No afterEach callback set.");
        }
    }
}

export const PlaywrightTestUtilsHelper =
    new PlaywrightTestUtilsHelperInstance();
