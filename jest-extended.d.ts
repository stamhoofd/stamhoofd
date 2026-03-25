import 'vitest'

declare module '@vitest/expect' {
  interface Matchers<T = any> {
    toMatchMap(map: Map<any, any>): void;
    toIncludeSameMembers<E = unknown>(expected: readonly E[]): void;
    toIncludeAllMembers<E = unknown>(expected: readonly E[] | E): void;
    toResolve(): Promise<void>
    toReject(): Promise<void>
  }
}

export {  };
