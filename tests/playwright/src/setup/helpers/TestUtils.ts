
type AfterCallback = () => void | Promise<void>;

/**
 * Similar to test-utils package but for playwright.
 * Never import this class directly in a test file: an instance is instantiated in the fixtures, reuse that instance.
 */
export class TestUtils {
    static instanceCount = 0;
    onceAfterEachCallbacks: AfterCallback[] = [];
    afterEachCallbacks: AfterCallback[] = [];
    beforeAllCallbacks: AfterCallback[] = [];
    afterAllCallbacks: AfterCallback[] = [];

    permanentEnvironmentOverrides: Record<string, any> = {};

    private environment: string;

    constructor(environment: typeof STAMHOOFD) {
        if(TestUtils.instanceCount > 0) {
            throw new Error('Never import this class directly in a test file: an instance is instantiated in the fixtures, reuse that instance.');
        }

        TestUtils.instanceCount++;
        this.environment = JSON.stringify(environment);
    }

    setEnvironment<Key extends keyof SharedEnvironment>(
        value: Key,
        newValue: (SharedEnvironment)[Key],
    ) {
        STAMHOOFD[value] = newValue as (typeof STAMHOOFD)[Key];
        STAMHOOFD.EXPOSE_FRONTEND_ENVIRONMENT[value] = newValue as (FrontendEnvironment)[Key];
    }

    setPermanentEnvironment<Key extends keyof SharedEnvironment>(
        value: Key,
        newValue: (SharedEnvironment)[Key],
    ) {
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

    beforeEach() {
        this.loadEnvironment();
    }

    loadEnvironment() {
        let globalObject: any = null;

        if (typeof global === "object") {
            globalObject = global;
        }

        if (typeof self === "object") {
            globalObject = self;
        }

        (globalObject as any).STAMHOOFD = JSON.parse(this.environment);

        // Reset permanent environment overrides
        for (const key in this.permanentEnvironmentOverrides) {
            this.setEnvironment(
                key as any,
                this.permanentEnvironmentOverrides[key],
            );
        }
    }
}
