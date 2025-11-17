import { loadEnvironment } from './src/loadEnvironment.js';

type AfterCallback = () => void | Promise<void>;
abstract class TestInstance {
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

    abstract loadEnvironment(): Promise<void>;

    abstract setup(initialEnvironment?: typeof STAMHOOFD): void;

    /**
     * Run this in each jest.global.setup.ts file
     */
    async globalSetup() {
        await this.loadEnvironment();
    }
}

class JestTestInstace extends TestInstance {
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
}

class PlaywrightTestInstance extends TestInstance {
    private environment?: string;

    async loadEnvironment() {
        if (!STAMHOOFD) {
            // STAMHOOFD should be loaded outside of TestUtils
            throw new Error('STAMHOOFD is not defined');
        }

        if (!this.environment) {
            // init environment
            this.environment = JSON.stringify(STAMHOOFD);
        }

        let globalObject: any = null;

        if (typeof global === 'object') {
            globalObject = global;
        }

        if (typeof self === 'object') {
            globalObject = self;
        }

        (globalObject as any).STAMHOOFD = JSON.parse(this.environment);

        // Reset permanent environment overrides
        for (const key in this.permanentEnvironmentOverrides) {
            this.setEnvironment(key as any, this.permanentEnvironmentOverrides[key]);
        }
    }

    setup() {
        // do nothing
    }
}

export const TestUtils: TestInstance = process.env.STAMHOOFD_ENV === 'playwright' ? new PlaywrightTestInstance() : new JestTestInstace();

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
