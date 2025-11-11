export interface TestHooks {
    beforeAll(callback: () => void | Promise<void>, timeout?: number): any;
    beforeEach(callback: () => void | Promise<void>, timeout?: number): any;
    afterEach(callback: () => void | Promise<void>, timeout?: number): any;
    afterAll(callback: () => void | Promise<void>, timeout?: number): any;
}
