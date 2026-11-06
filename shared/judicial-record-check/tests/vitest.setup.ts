import { TestUtils } from '@stamhoofd/test-utils';

// TestUtils installs a $t that returns the key and ignores its replacements. Every reason this
// package produces names a date, a name or a limit through those, so define a $t that substitutes
// them first: TestUtils leaves an existing one alone, and the tests can then assert that what a
// member reads actually mentions the right one.
const globalObject = globalThis as unknown as { $t?: unknown };

globalObject.$t = (key: string, replace?: Record<string, string | { toString(): string }>) => {
    let text = key;

    for (const name in replace) {
        text = text.replaceAll(`{${name}}`, replace[name].toString());
    }

    return text;
};

TestUtils.setup();
