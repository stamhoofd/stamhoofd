import { I18nController } from '@stamhoofd/frontend-i18n';
import { Country } from '../../../shared/types/src/Country';
import { Language } from '../../../shared/types/src/Language';
import { TestUtils } from '../../../shared/test-utils/src/index';
import { afterEach, beforeAll, beforeEach } from 'vitest';

// Browser tests run shared test-utils in the browser, where process does not exist.
(globalThis as any).process ??= { env: {} };
(globalThis as any).process.env ??= {};

// In vitest there is no alternative for setupfiles after env, so the env has not been setup yet...
(window as any).beforeAll = beforeAll;
(window as any).beforeEach = beforeEach;
(window as any).afterEach = afterEach;

TestUtils.setup();
TestUtils.loadEnvironment();

Error.stackTraceLimit = Infinity;

beforeAll(async () => {
    await I18nController.loadDefault(null, Country.Belgium, Language.Dutch, Country.Belgium);
});
