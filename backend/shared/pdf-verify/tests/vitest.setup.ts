import { TestUtils } from '@stamhoofd/test-utils';

// The messages this package passes on name the signer through replacements, so substitute them
// rather than returning the bare key: the tests assert what a member actually reads.
const globalObject = globalThis as unknown as { $t?: unknown };

globalObject.$t = (key: string, replace?: Record<string, string | { toString(): string }>) => {
    let text = key;

    for (const name in replace) {
        text = text.replaceAll(`{${name}}`, replace[name].toString());
    }

    return text;
};

TestUtils.setup();
