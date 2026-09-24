import type { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, MemberResponsibilityRecord, MemberResponsibilityRecordFactory, OrganizationFactory, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import { FlagMomentCleanup } from './FlagMomentCleanup.js';

const DAY = 1000 * 60 * 60 * 24;

describe('FlagMomentCleanup.endResponsibilitiesOfUnregisteredMembers', () => {
    let organization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        // Far enough from the period start and end to be outside of the period grace windows
        const period = await new RegistrationPeriodFactory({
            startDate: new Date(Date.now() - 200 * DAY),
            endDate: new Date(Date.now() + 200 * DAY),
        }).create();
        organization = await new OrganizationFactory({ period }).create();
    });

    async function createResponsibleMember({ groupDeletedAt, period }: { groupDeletedAt?: Date | null; period?: RegistrationPeriod } = {}) {
        const member = await new MemberFactory({ organization }).create();
        if (groupDeletedAt !== undefined) {
            const group = await new GroupFactory({ organization, period }).create();
            await new RegistrationFactory({ member, group }).create();
            if (groupDeletedAt) {
                group.deletedAt = groupDeletedAt;
                await group.save();
            }
        }
        return await new MemberResponsibilityRecordFactory({ member }).create();
    }

    async function isEnded(record: MemberResponsibilityRecord) {
        const reloaded = await MemberResponsibilityRecord.getByID(record.id);
        return reloaded!.endDate !== null;
    }

    test('registrations in deleted groups keep responsibilities until 14 days after the deletion', async () => {
        const recentlyDeleted = await createResponsibleMember({ groupDeletedAt: new Date(Date.now() - 5 * DAY) });
        const deletedLongAgo = await createResponsibleMember({ groupDeletedAt: new Date(Date.now() - 30 * DAY) });
        const registered = await createResponsibleMember({ groupDeletedAt: null });
        const notRegistered = await createResponsibleMember();
        const previousPeriod = await new RegistrationPeriodFactory({
            organization,
            startDate: new Date(Date.now() - 565 * DAY),
            endDate: new Date(Date.now() - 200 * DAY),
        }).create();
        const onlyRegisteredInPreviousPeriod = await createResponsibleMember({ groupDeletedAt: null, period: previousPeriod });

        await FlagMomentCleanup.endResponsibilitiesOfUnregisteredMembers();

        expect(await isEnded(recentlyDeleted)).toBe(false);
        expect(await isEnded(deletedLongAgo)).toBe(true);
        expect(await isEnded(registered)).toBe(false);
        expect(await isEnded(notRegistered)).toBe(true);
        expect(await isEnded(onlyRegisteredInPreviousPeriod)).toBe(true);
    });
});
