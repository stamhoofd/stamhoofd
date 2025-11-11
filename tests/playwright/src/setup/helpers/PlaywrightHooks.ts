import { TestHooks } from "@stamhoofd/test-utils";
import { test } from '@playwright/test';

export class PlaywrightHooks implements TestHooks {
    beforeAll(callback: () => Promise<any> | any, timeout?: number) {
        test.beforeAll(callback);
    }

    beforeEach(callback: () => void | Promise<void>, timeout?: number) {
        test.beforeEach(callback);
    }

    afterEach(callback: () => void | Promise<void>, timeout?: number) {
        test.afterEach(callback);
    }

    afterAll(callback: () => void | Promise<void>, timeout?: number) {
        test.afterAll(callback);
    }
}
