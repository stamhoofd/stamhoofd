import { loadEnvironment } from './src/loadEnvironment';

type AfterCallback = () => void | Promise<void>;
class TestInstance {
    onceAfterEachCallbacks: AfterCallback[] = [];
    afterEachCallbacks: AfterCallback[] = [];
    beforeAllCallbacks: AfterCallback[] = [];

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

    loadEnvironment() {
        // Clear env
        loadEnvironment();

        // Reset permanent environment overrides
        for (const key in this.permanentEnvironmentOverrides) {
            this.setEnvironment(key as any, this.permanentEnvironmentOverrides[key]);
        }
    }

    async beforeEach() {
        this.loadEnvironment();
    }

    /**
     * Run this in each jest.setup.ts file
     */
    setup() {
        beforeAll(async () => {
            this.loadEnvironment();
            await this.beforeAll();
        });

        beforeEach(async () => {
            await this.beforeEach();
        });

        afterEach(async () => {
            await this.afterEach();
        });

        // Sometimes there is code outside the test 'describe' that needs the environment already
        this.loadEnvironment();
    }

    /**
     * Run this in each jest.global.setup.ts file
     */
    async globalSetup() {
        // todo
    }
}

export const TestUtils = new TestInstance();

export const STExpect = {
    errorWithCode: (code: string) => expect.objectContaining({ code }) as jest.Constructable,
    errorWithMessage: (message: string) => expect.objectContaining({ message }) as jest.Constructable,
    simpleError: (data: {
        code?: string;
        message?: string;
        field?: string;
    }) => {
        const d = {
            code: data.code ?? expect.any(String),
            message: data.message ?? expect.any(String),
            field: data.field ?? expect.anything(),
        };

        if (!data.field) {
            delete d.field;
        }
        return expect.objectContaining(d) as jest.Constructable;
    },
    simpleErrors: (data: {
        code?: string;
        message?: string;
        field?: string;
    }[]) => {
        return expect.objectContaining({
            errors: data.map(d => STExpect.simpleError(d)),
        }) as jest.Constructable;
    },
};
