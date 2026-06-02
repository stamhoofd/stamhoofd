declare global {
    namespace jest {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Must match Vitest's jest.Matchers type parameters exactly.
        interface Matchers<R, T = {}> {
            toMatchMap(map: Map<any, any>): void;
            toIncludeSameMembers<E = unknown>(expected: readonly E[]): void;
            toIncludeAllMembers<E = unknown>(expected: readonly E[] | E): void;
            toResolve(): Promise<void>;
            toReject(): Promise<void>;
        }
    }
}

declare module '@vitest/expect' {
    interface Matchers<T = any> {
        toMatchMap(map: Map<any, any>): void;
        toIncludeSameMembers<E = unknown>(expected: readonly E[]): void;
        toIncludeAllMembers<E = unknown>(expected: readonly E[] | E): void;
        toResolve(): Promise<void>;
        toReject(): Promise<void>;
    }

    interface Assertion<T = any> {
        toMatchMap(map: Map<any, any>): void;
        toIncludeSameMembers<E = unknown>(expected: readonly E[]): void;
        toIncludeAllMembers<E = unknown>(expected: readonly E[] | E): void;
        toResolve(): Promise<void>;
        toReject(): Promise<void>;
    }

    interface AsymmetricMatchersContaining {
        toMatchMap(map: Map<any, any>): any;
    }

    interface ExpectStatic {
        toMatchMap(map: Map<any, any>): any;
    }
}

declare module 'vitest' {
    interface Assertion<T = any> {
        toMatchMap(map: Map<any, any>): void;
        toIncludeSameMembers<E = unknown>(expected: readonly E[]): void;
        toIncludeAllMembers<E = unknown>(expected: readonly E[] | E): void;
        toResolve(): Promise<void>;
        toReject(): Promise<void>;
    }

    interface AsymmetricMatchersContaining {
        toMatchMap(map: Map<any, any>): any;
    }

    interface ExpectStatic {
        toMatchMap(map: Map<any, any>): any;
    }
}

export {};
