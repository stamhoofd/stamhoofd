import { test } from "@playwright/test";
import { TestHelper } from "@stamhoofd/test-utils";

export class PlaywrightTestUtilsHelperInstance implements TestHelper {
    private environment: string | null = null;
    private _test: typeof test | null = null;

    private get base() {
        if (this._test === null) {
            throw new Error("Test not set.");
        }
        return this._test;
    }

    setDefaultEnvironment(environment: typeof STAMHOOFD) {
        this.environment = JSON.stringify(environment);
    }

    afterSetEnvironment<Key extends keyof SharedEnvironment>(
        value: Key,
        newValue: SharedEnvironment[Key],
    ): void {
        STAMHOOFD.EXPOSE_FRONTEND_ENVIRONMENT[value] =
            newValue as FrontendEnvironment[Key];
    }

    setTest(value: typeof test) {
        this._test = value;
    }

    async loadEnvironment(): Promise<void> {
        if (this.environment === null) {
            throw new Error("Environment not set.");
        }

        let globalObject: any = null;

        if (typeof global === "object") {
            globalObject = global;
        }

        if (typeof self === "object") {
            globalObject = self;
        }

        (globalObject as any).STAMHOOFD = JSON.parse(this.environment);
    }

    beforeAll(callback: () => void | Promise<void>) {
        this.base.beforeAll(callback);
    }

    beforeEach(callback: () => void | Promise<void>) {
        this.base.beforeEach(callback);
    }

    afterEach(callback: () => void | Promise<void>) {
        this.base.afterEach(callback);
    }

    afterAll(callback: () => void | Promise<void>) {
        this.base.afterAll(callback);
    }
}

export const PlaywrightTestUtilsHelper =
    new PlaywrightTestUtilsHelperInstance();
