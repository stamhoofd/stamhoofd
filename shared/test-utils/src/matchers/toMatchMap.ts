type MatcherStateLike = {
    equals: any;
    utils: any;
};

export function toMatchMap(this: MatcherStateLike, actual: unknown, map: Map<any, any>) {
    const matcherState = this;

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
                `expected ${matcherState.utils.printReceived(
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
                    `expected ${matcherState.utils.printReceived(
                        actual,
                    )} to have key ${matcherState.utils.printExpected(key)}`,
                pass: false,
            };
        }

        // Compare values
        const expectedValue = map.get(key);
        const actualValue = actual.get(key);

        if (!matcherState.equals(expectedValue, actualValue)) {
            return {
                message: () =>
                    `expected ${matcherState.utils.diff(actualValue, expectedValue)} at key ${matcherState.utils.printExpected(key)}`,
                pass: false,
            };
        }
    }

    // Check for extra keys in actual
    for (const key of actual.keys()) {
        if (!map.has(key)) {
            return {
                message: () =>
                    `unexpected key ${matcherState.utils.printExpected(key)} in Map`,
                pass: false,
            };
        }
    }

    return {
        message: () => `ok`,
        pass: true,
    };
};
