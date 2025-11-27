import { TestHelper } from './TestHelper';
import { loadEnvironment } from './loadEnvironment.js';

export class JestHelper implements TestHelper {
    async loadEnvironment(): Promise<void> {
        // Clear env
        await loadEnvironment();
    }

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
