import { TestUtils } from '@stamhoofd/test-utils';

// The tests assert what a member actually reads, so `$t` answers with the text rather than a key.
const globalObject = globalThis as unknown as { $t?: unknown };

globalObject.$t = (key: string) => key;

TestUtils.setup();
