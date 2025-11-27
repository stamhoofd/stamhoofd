export interface TestHelper {
    loadEnvironment(): Promise<void>;
    beforeAll(callback: () => void | Promise<void>, timeout?: number): any;
    beforeEach(callback: () => void | Promise<void>, timeout?: number): any;
    afterEach(callback: () => void | Promise<void>, timeout?: number): any;
    afterAll(callback: () => void | Promise<void>, timeout?: number): any;

    /**
     * Hook that get called after the environment is set
     * @param value
     * @param newValue
     */
    afterSetEnvironment?<Key extends keyof SharedEnvironment>(value: Key,
        newValue: (SharedEnvironment)[Key]): void;
}
