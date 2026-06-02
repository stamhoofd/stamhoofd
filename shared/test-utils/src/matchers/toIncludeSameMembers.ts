type MatcherStateLike = {
    customTesters: any;
    equals: any;
    utils: any;
};

/*! 
 * Copyright (c) 2017-present Matt Phillips <matt@mattphillips.io> (mattphillips.io)
 * Licensed under the MIT License
 * https://opensource.org/licenses/MIT
 * Original code from: https://github.com/jest-community/jest-extended
*/

export function toIncludeSameMembers<E = unknown>(this: MatcherStateLike, actual: unknown, expected: readonly E[]) {
    const matcherState = this;
    const { printReceived, printExpected, matcherHint } = matcherState.utils;

    const pass
    = Array.isArray(actual)
        && Array.isArray(expected)
        && predicate((a: unknown, b: unknown) => matcherState.equals(a, b, matcherState.customTesters), actual, expected);

    return {
        pass,
        message: () =>
            pass
                ? matcherHint('.not.toIncludeSameMembers')
                + '\n\n'
                + 'Expected list to not exactly match the members of:\n'
                + `  ${printExpected(expected)}\n`
                + 'Received:\n'
                + `  ${printReceived(actual)}`
                : matcherHint('.toIncludeSameMembers')
                    + '\n\n'
                    + 'Expected list to have the following members and no more:\n'
                    + `  ${printExpected(expected)}\n`
                    + 'Received:\n'
                    + `  ${printReceived(actual)}`,
    };
}

const predicate = (equals: (a: unknown, b: unknown) => boolean, actual: unknown, expected: unknown) => {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
        return false;
    }

    const remaining = expected.reduce<unknown[] | null>((remaining, secondValue) => {
        if (remaining === null) return remaining;

        const index = remaining.findIndex((firstValue: unknown) => equals(secondValue, firstValue));

        if (index === -1) {
            return null;
        }

        return remaining.slice(0, index).concat(remaining.slice(index + 1));
    }, actual);

    return !!remaining && remaining.length === 0;
};
