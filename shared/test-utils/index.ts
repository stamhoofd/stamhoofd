import { loadEnvironment } from './src/loadEnvironment';

type AfterCallback = () => void | Promise<void>;
class TestInstance {
    onceAfterEachCallbacks: AfterCallback[] = [];
    afterEachCallbacks: AfterCallback[] = [];

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
