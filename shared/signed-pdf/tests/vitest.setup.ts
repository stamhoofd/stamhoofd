import { TestUtils } from '@stamhoofd/test-utils';

// TestUtils installs a $t that returns the key and ignores its replacements. Every explanation this
// package produces names the caller's signer and document through those, so define a $t that
// substitutes them first: TestUtils leaves an existing one alone, and the tests can then assert that
// what the member reads actually mentions the right signer.
const globalObject = globalThis as unknown as { $t?: unknown };

globalObject.$t = (key: string, replace?: Record<string, string | { toString(): string }>) => {
    let text = key;

    for (const name in replace) {
        text = text.replaceAll(`{${name}}`, replace[name].toString());
    }

    return text;
};

TestUtils.setup();
