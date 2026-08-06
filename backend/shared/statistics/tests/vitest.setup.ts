import { Database } from '@simonbackx/simple-database';
import { TestUtils } from '@stamhoofd/test-utils';

afterAll(async () => {
    await Database.end();
});

TestUtils.setup();
