import { TestUtils } from '@stamhoofd/test-utils';
import { beforeAll, beforeEach, afterEach } from 'vitest';

// In vitest there is no alternative for setupfiles after env, so the env has not been setup yet...
(window as any).beforeAll = beforeAll;
(window as any).beforeEach = beforeEach;
(window as any).afterEach = afterEach;

TestUtils.setup();
await TestUtils.loadEnvironment();
