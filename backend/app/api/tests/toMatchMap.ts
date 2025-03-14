import { expect } from '@jest/globals';
import type { MatcherFunction } from 'expect';
import 'jest';

const toMatchMap: MatcherFunction<[map: unknown]> = function (actual, map: Map<any, any>) {
    if (
        !(map instanceof Map)
    ) {
        throw new TypeError('You need to pass a Map to toMatchMap');
    }

    if (
        !(actual instanceof Map)
    ) {
        return {
            message: () =>
                `expected ${this.utils.printReceived(
                    actual,
                )} to be a Map`,
            pass: false,
        };
    }

    for (const key of map.keys()) {
        // Check key exists
        if (!actual.has(key)) {
            return {
                message: () =>
                    `expected ${this.utils.printReceived(
                        actual,
                    )} to have key ${this.utils.printExpected(key)}`,
                pass: false,
            };
        }

        // Compare values
        const expectedValue = map.get(key);
        const actualValue = actual.get(key);

        if (!this.equals(expectedValue, actualValue)) {
            return {
                message: () =>
                    `expected ${this.utils.diff(actualValue, expectedValue)} at key ${this.utils.printExpected(key)}`,
                pass: false,
            };
        }
    }

    // Check for extra keys in actual
    for (const key of actual.keys()) {
        if (!map.has(key)) {
            return {
                message: () =>
                    `unexpected key ${this.utils.printExpected(key)} in Map`,
                pass: false,
            };
        }
    }

    return {
        message: () => `ok`,
        pass: true,
    };
};

expect.extend({
    toMatchMap,
});
