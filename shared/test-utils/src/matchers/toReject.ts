/*!
 * Copyright (c) 2017-present Matt Phillips <matt@mattphillips.io> (mattphillips.io)
 * Licensed under the MIT License
 * https://opensource.org/licenses/MIT
 * Original code from: https://github.com/jest-community/jest-extended
*/

export async function toReject(actual: Promise<unknown>) {
  const { matcherHint } = this.utils;

  const pass = await actual.then(
    () => false,
    () => true,
  );

  return {
    pass,
    message: () =>
      pass
        ? matcherHint('.not.toReject', 'received', '') + '\n\nExpected promise to resolve, however it rejected.\n'
        : matcherHint('.toReject', 'received', '') + '\n\nExpected promise to reject, however it resolved.\n',
  };
}
