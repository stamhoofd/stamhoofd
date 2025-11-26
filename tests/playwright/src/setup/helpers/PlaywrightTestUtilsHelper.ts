import { TestHelper } from "@stamhoofd/test-utils";

export class PlaywrightTestUtilsHelperInstance implements TestHelper {
    private environment: string | null = null;

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

    private beforeAllCallback: (() => void | Promise<void>) | null = null;
    beforeAll(callback: () => void | Promise<void>) {
        this.beforeAllCallback = callback;
    }

    async executeBeforeAll() {
        if (this.beforeAllCallback !== null) {
            await this.beforeAllCallback();
        } else {
            console.warn("No beforeAll callback set.");
        }
    }

    private afterAllCallback: (() => void | Promise<void>) | null = null;
    afterAll(callback: () => void | Promise<void>) {
        this.afterAllCallback = callback;
    }

    async executeAfterAll() {
        if (this.afterAllCallback !== null) {
            await this.afterAllCallback();
        } else {
            console.warn("No afterAll callback set.");
        }
    }

    private beforeEachCallback: (() => void | Promise<void>) | null = null;
    beforeEach(callback: () => void | Promise<void>) {
        this.beforeEachCallback = callback;
    }

    async executeBeforeEach() {
        if (this.beforeEachCallback !== null) {
            await this.beforeEachCallback();
        } else {
            console.warn("No beforeEach callback set.");
        }
    }

    private afterEachCallback: (() => void | Promise<void>) | null = null;
    afterEach(callback: () => void | Promise<void>) {
        this.afterEachCallback = callback;
    }

    async executeAfterEach() {
        if (this.afterEachCallback !== null) {
            await this.afterEachCallback();
        } else {
            console.warn("No afterEach callback set.");
        }
    }
}

export const PlaywrightTestUtilsHelper =
    new PlaywrightTestUtilsHelperInstance();
