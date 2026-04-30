import { I18nController } from '@stamhoofd/frontend-i18n';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { Language } from '@stamhoofd/types/Language';
import { afterEach, beforeAll, beforeEach } from 'vitest';

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
