import { Group, GroupFactory, OrganizationFactory } from '@stamhoofd/models';
import { fillGroupCachedPeriods } from './1791830000-groups-cached-period.js';

describe('Seed.groups-cached-period', () => {
    test('It fills the cached period of groups without one and keeps existing ones', async () => {
        const organization = await new OrganizationFactory({}).create();

        const missing = await new GroupFactory({ organization }).create();
        missing.settings.period = null;
        await missing.save();

        const existing = await new GroupFactory({ organization }).create();
        const existingCached = existing.settings.period!;
        existingCached.customName = 'Custom cached name';
        await existing.save();

        await fillGroupCachedPeriods();

        const updatedMissing = await Group.getByID(missing.id);
        expect(updatedMissing?.settings.period?.id).toBe(organization.periodId);

        const updatedExisting = await Group.getByID(existing.id);
        expect(updatedExisting?.settings.period?.customName).toBe('Custom cached name');
    });
});
