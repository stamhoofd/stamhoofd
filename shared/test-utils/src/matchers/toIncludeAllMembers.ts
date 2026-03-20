/*!
 * Copyright (c) 2017-present Matt Phillips <matt@mattphillips.io> (mattphillips.io)
 * Licensed under the MIT License
 * https://opensource.org/licenses/MIT
 * Original code from: https://github.com/jest-community/jest-extended
*/

const contains = (equals: any, list: any, value: any) => {
    return list.findIndex((item: any) => equals(item, value)) > -1;
};

export function toIncludeAllMembers<E = unknown>(actual: unknown[], expected: readonly E[] | E) {
    const { printReceived, printExpected, matcherHint } = this.utils;

    const pass
    = Array.isArray(actual)
        && Array.isArray(expected)
        && expected.every(val => contains((a: unknown, b: unknown) => this.equals(a, b, this.customTesters), actual, val));

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
