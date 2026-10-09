import { test, setup } from '../test-fixtures/base.js';
setup();

import { expect } from '@playwright/test';
import { OrganizationFactory } from '@stamhoofd/models';
import { Version } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/worker/WorkerData.js';

test('organization search indexes new rows after repeated database resets @database-reset', async ({ request }) => {
    for (let iteration = 0; iteration < 3; iteration++) {
        await WorkerData.resetDatabase();
        const organization = await new OrganizationFactory({ name: 'Resetsearch organization' }).create();

        const response = await request.get(`${WorkerData.urls.api}/v${Version}/organizations/search`, {
            params: { query: 'Resetsearch' },
        });
        expect(response.ok()).toBe(true);
        expect(await response.json()).toMatchObject([{ id: organization.id, name: organization.name }]);
    }
});
