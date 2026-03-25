import { test } from '@playwright/test';
import type { TestHooks } from '@stamhoofd/test-utils';

export class PlaywrightHooks implements TestHooks {
    beforeAll(callback: () => Promise<any> | any) {
        test.beforeAll(callback);
    }

    beforeEach(callback: () => void | Promise<void>) {
        test.beforeEach(callback);
    }

    afterEach(callback: () => void | Promise<void>) {
        test.afterEach(callback);
    }

    afterAll(callback: () => void | Promise<void>) {
        test.afterAll(callback);
    }
}
