interface STCustomMatchers {
    toMatchMap(map: Map<any, any>): void;
    toIncludeSameMembers<E = unknown>(expected: readonly E[]): void;
    toIncludeAllMembers<E = unknown>(expected: readonly E[] | E): void;
    toResolve(): Promise<void>;
    toReject(): Promise<void>;
}

declare global {
    namespace jest {
        interface Matchers<R, T = {}> extends STCustomMatchers {}
    }
}

declare module 'vitest' {
    interface Assertion<T = any> extends STCustomMatchers {}

    interface AsymmetricMatchersContaining {
        toMatchMap(map: Map<any, any>): any;
    }

    interface ExpectStatic {
        toMatchMap(map: Map<any, any>): any;
    }
}

export {};
