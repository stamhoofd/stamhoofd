import { TestHooks } from './TestHooks.js';

export class JestHooks implements TestHooks {
    beforeAll(callback: () => void | Promise<void>, timeout?: number) {
        beforeAll(callback, timeout);
    }

    beforeEach(callback: () => void | Promise<void>, timeout?: number) {
        beforeEach(callback, timeout);
    }

    afterEach(callback: () => void | Promise<void>, timeout?: number) {
        afterEach(callback, timeout);
    }

    afterAll(callback: () => void | Promise<void>, timeout?: number) {
        afterAll(callback, timeout);
    }
}
