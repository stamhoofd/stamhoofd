import { JestHooks } from './JestHooks.js';
import { getGlobalObject, loadEnvironment, updateLinkedEnvs } from './loadEnvironment.js';
import { toIncludeAllMembers } from './matchers/toIncludeAllMembers.js';
import { toIncludeSameMembers } from './matchers/toIncludeSameMembers.js';
import { toMatchMap } from './matchers/toMatchMap.js';
import { toReject } from './matchers/toReject.js';
import { toResolve } from './matchers/toResolve.js';
import type { TestHooks } from './TestHooks.js';

type AfterCallback = () => void | Promise<void>;
class TestInstance {
    onceAfterEachCallbacks: AfterCallback[] = [];
    afterEachCallbacks: AfterCallback[] = [];
    beforeAllCallbacks: AfterCallback[] = [];
    afterAllCallbacks: AfterCallback[] = [];

    permanentEnvironmentOverrides: Record<string, any> = {};

    private hooks: TestHooks = new JestHooks();

    setEnvironment<Key extends keyof typeof STAMHOOFD>(value: Key, newValue: typeof STAMHOOFD[Key]) {
        STAMHOOFD[value] = newValue as (typeof STAMHOOFD)[Key];

        // Update process.env that might be linked to STAMHOOFD
        updateLinkedEnvs();
    }

    setPermanentEnvironment<Key extends keyof typeof STAMHOOFD>(value: Key, newValue: typeof STAMHOOFD[Key]) {
        this.permanentEnvironmentOverrides[value] = newValue;

        if (getGlobalObject().STAMHOOFD && typeof getGlobalObject().STAMHOOFD === 'object') {
            // If already loaded the environment, set it immediately
            this.setEnvironment(value, newValue);
        }
    }

    /**
     * Schedule once after this test, for example for cleaning up this test
     */
    scheduleAfterThisTest(callback: AfterCallback) {
        this.onceAfterEachCallbacks.push(callback);
    }

    /**
     * Will run after each test in this test suite
     */
    addAfterEach(callback: AfterCallback) {
        this.afterEachCallbacks.push(callback);
    }

    /**
     * Will run after each test in this test suite
     */
    addBeforeAll(callback: AfterCallback) {
        this.beforeAllCallbacks.push(callback);
    }

    addAfterAll(callback: AfterCallback) {
        this.afterAllCallbacks.push(callback);
    }

    async beforeAll() {
        for (const callback of this.beforeAllCallbacks) {
            await callback();
        }
    }

    async afterEach() {
        for (const callback of this.afterEachCallbacks) {
            await callback();
        }

        for (const callback of this.onceAfterEachCallbacks) {
            await callback();
        }
        this.onceAfterEachCallbacks = [];
    }

    async afterAll() {
        for (const callback of this.afterAllCallbacks) {
            await callback();
        }
    }

    async beforeEach() {
        this.loadEnvironment();
    }

    loadEnvironment() {
        // Clear env
        loadEnvironment();

        // Reset permanent environment overrides
        for (const key in this.permanentEnvironmentOverrides) {
            this.setEnvironment(key as any, this.permanentEnvironmentOverrides[key]);
        }
    }

    /**
     * Run this in each jest.setup.ts file
     */
    setup() {
        this.loadEnvironment();
        this.hooks.beforeAll(async () => {
            this.loadEnvironment();
            await this.beforeAll();
        });

        this.hooks.beforeEach(async () => {
            await this.beforeEach();
        });

        this.hooks.afterEach(async () => {
            await this.afterEach();
        });

        this.hooks.afterAll(async () => {
            await this.afterAll();
        });

        expect.extend({
            toIncludeSameMembers,
            toMatchMap,
            toResolve,
            toIncludeAllMembers,
            toReject
        });
    }

    /**
     * Run this in each jest.global.setup.ts file
     */
    globalSetup(testHelper?: TestHooks) {
        if (testHelper) {
            this.hooks = testHelper;
        }
        this.loadEnvironment();
    }
}

export const TestUtils: TestInstance = new TestInstance();

export * from './TestHooks.js';

export const STExpect = {
    errorWithCode: (code: string) => expect.objectContaining({ code }) /* as jest.Constructable */,
    errorWithMessage: (message: string) => expect.objectContaining({ message })/* as jest.Constructable */,
    simpleError: (data: {
        code?: string;
        message?: string | RegExp;
        field?: string;
    }) => {
        const d = {
            code: data.code ?? expect.any(String),
            message: data.message ? expect.stringMatching(data.message) : expect.any(String),
            field: data.field ?? expect.anything(),
        };

        if (!data.field) {
            delete d.field;
        }
        return expect.objectContaining(d);
    },
    simpleErrors: (data: {
        code?: string;
        message?: string | RegExp;
        field?: string;
    }[]) => {
        return expect.objectContaining({
            errors: data.map(d => STExpect.simpleError(d)),
        });
    },
};
