// import { type TestUtils } from '@stamhoofd/test-utils';
import { type TestUtils } from "@stamhoofd/test-utils";
import { createRequire } from "node:module";

class TestUtilsHelperInstance {
    private _testUtils: typeof TestUtils | null = null;

    get TestUtils() {
        if(this._testUtils === null) {
            throw new Error('TestUtils is not initialized');
        }
        return this._testUtils;
    }

    setup() {
        this.init();
        this.TestUtils.setup();
    }

    private init() {
        // Force load the cjs version of test-utils because the esm version gives issues with the json environment
        const require = createRequire(import.meta.url);
        const { TestUtils } = require("@stamhoofd/test-utils");
        this._testUtils = TestUtils;
    }

    async beforeAll() {
        await this.TestUtils.loadEnvironment();
        await this.TestUtils.beforeAll();
    }

    async beforeEach() {
        await this.TestUtils.beforeEach();
    }

    async afterEach() {
        await this.TestUtils.afterEach();
    }

    async afterAll() {
        await this.TestUtils.afterAll();
    }
}

export const TestUtilsHelper = new TestUtilsHelperInstance();
