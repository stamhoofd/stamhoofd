import { loadEnvironment } from './src/loadEnvironment.js';

type AfterCallback = () => void | Promise<void>;
class TestInstance {
    onceAfterEachCallbacks: AfterCallback[] = [];
    afterEachCallbacks: AfterCallback[] = [];
    beforeAllCallbacks: AfterCallback[] = [];
    afterAllCallbacks: AfterCallback[] = [];

    permanentEnvironmentOverrides: Record<string, any> = {};

    setEnvironment<Key extends keyof typeof STAMHOOFD>(value: Key, newValue: typeof STAMHOOFD[Key]) {
        (STAMHOOFD as any)[value] = newValue;
    }

    setPermanentEnvironment<Key extends keyof typeof STAMHOOFD>(value: Key, newValue: typeof STAMHOOFD[Key]) {
        this.permanentEnvironmentOverrides[value] = newValue;
        this.setEnvironment(value, newValue);
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
        await this.loadEnvironment();
    }

    async loadEnvironment() {
        // Clear env
        await loadEnvironment();

        // Reset permanent environment overrides
        for (const key in this.permanentEnvironmentOverrides) {
            this.setEnvironment(key as any, this.permanentEnvironmentOverrides[key]);
        }
    }

    /**
     * Run this in each jest.setup.ts file
     */
    setup() {
        beforeAll(async () => {
            await this.loadEnvironment();
            await this.beforeAll();
        });

        beforeEach(async () => {
            await this.beforeEach();
        });

        afterEach(async () => {
            await this.afterEach();
        });

        afterAll(async () => {
            await this.afterAll();
        });
    }

    /**
     * Run this in each jest.global.setup.ts file
     */
    async globalSetup() {
        await this.loadEnvironment();
    }
}

export const TestUtils: TestInstance = new TestInstance();

export const STExpect = {
    errorWithCode: (code: string) => expect.objectContaining({ code }) as jest.Constructable,
    errorWithMessage: (message: string) => expect.objectContaining({ message }) as jest.Constructable,
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
        return expect.objectContaining(d) as jest.Constructable;
    },
    simpleErrors: (data: {
        code?: string;
        message?: string | RegExp;
        field?: string;
    }[]) => {
        return expect.objectContaining({
            errors: data.map(d => STExpect.simpleError(d)),
        }) as jest.Constructable;
    },
};
