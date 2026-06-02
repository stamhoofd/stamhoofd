type MatcherStateLike = {
    utils: any;
};

/*! 
 * Copyright (c) 2017-present Matt Phillips <matt@mattphillips.io> (mattphillips.io)
 * Licensed under the MIT License
 * https://opensource.org/licenses/MIT
 * Original code from: https://github.com/jest-community/jest-extended
*/

export async function toResolve(this: MatcherStateLike, actual: Promise<unknown>) {
    const matcherState = this;
    const { matcherHint } = matcherState.utils;

    const pass = await actual.then(
        () => true,
        () => false,
    );

    return {
        pass,
        message: () =>
            pass
                ? matcherHint('.not.toResolve', 'received', '') + '\n\nExpected promise to reject, however it resolved.\n'
                : matcherHint('.toResolve', 'received', '') + '\n\nExpected promise to resolve, however it rejected.\n',
    };
}
