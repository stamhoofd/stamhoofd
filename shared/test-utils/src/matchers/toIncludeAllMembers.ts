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

const contains = (equals: any, list: any, value: any) => {
    return list.findIndex((item: any) => equals(item, value)) > -1;
};

export function toIncludeAllMembers<E = unknown>(this: MatcherStateLike, actual: unknown[], expected: readonly E[] | E) {
    const matcherState = this;
    const { printReceived, printExpected, matcherHint } = matcherState.utils;

    const pass
    = Array.isArray(actual)
        && Array.isArray(expected)
        && expected.every(val => contains((a: unknown, b: unknown) => matcherState.equals(a, b, matcherState.customTesters), actual, val));

    return {
        pass,
        message: () =>
            pass
                ? matcherHint('.not.toIncludeAllMembers')
                + '\n\n'
                + 'Expected list to not have all of the following members:\n'
                + `  ${printExpected(expected)}\n`
                + 'Received:\n'
                + `  ${printReceived(actual)}`
                : matcherHint('.toIncludeAllMembers')
                    + '\n\n'
                    + 'Expected list to have all of the following members:\n'
                    + `  ${printExpected(expected)}\n`
                    + 'Received:\n'
                    + `  ${printReceived(actual)}`,
    };
}
