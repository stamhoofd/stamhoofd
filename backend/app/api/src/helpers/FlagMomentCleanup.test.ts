import type { Organization, RegistrationPeriod } from '@stamhoofd/models';
import { GroupFactory, MemberFactory, MemberResponsibilityRecord, OrganizationFactory, PlatformResponsibilityFactory, RegistrationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { v4 as uuidv4 } from 'uuid';
import { TestUtils } from '@stamhoofd/test-utils';
import { FlagMomentCleanup } from './FlagMomentCleanup.js';

const DAY = 1000 * 60 * 60 * 24;

describe('FlagMomentCleanup.endResponsibilitiesOfUnregisteredMembers', () => {
    let organization: Organization;

    async function createOrganization() {
        // Far enough from the period start and end to be outside of the period grace windows
        const period = await new RegistrationPeriodFactory({
            startDate: new Date(Date.now() - 200 * DAY),
            endDate: new Date(Date.now() + 200 * DAY),
        }).create();
        organization = await new OrganizationFactory({ period }).create();
    }

    async function createResponsibleMember({ groupDeletedAt, period, defaultAgeGroupId, responsibilityId }: {
        groupDeletedAt?: Date | null;
        period?: RegistrationPeriod;
        defaultAgeGroupId?: string;
        responsibilityId?: string;
    } = {}) {
        const member = await new MemberFactory({ organization }).create();
        if (groupDeletedAt !== undefined) {
            const group = await new GroupFactory({ organization, period }).create();
            await new RegistrationFactory({ member, group }).create();
            group.deletedAt = groupDeletedAt;
            group.defaultAgeGroupId = defaultAgeGroupId ?? null;
            await group.save();
        }

        // Members have no organizationId in platform mode, so the record is not created with MemberResponsibilityRecordFactory
        const record = new MemberResponsibilityRecord();
        record.memberId = member.id;
        record.organizationId = organization.id;
        record.responsibilityId = responsibilityId ?? (await new PlatformResponsibilityFactory({}).create()).id;
        record.startDate = new Date(Date.now() - 200 * DAY);
        await record.save();
        return record;
    }

    async function isEnded(record: MemberResponsibilityRecord) {
        const reloaded = await MemberResponsibilityRecord.getByID(record.id);
        return reloaded!.endDate !== null;
    }

    describe('organization mode', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'organization');
            await createOrganization();
        });

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

    describe('platform mode', () => {
        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'platform');
            await createOrganization();
        });

        test('platform responsibilities are only kept by registrations in groups linked to a default age group', async () => {
            // createResponsibleMember adds a new platform responsibility by default
            const inDefaultAgeGroup = await createResponsibleMember({ groupDeletedAt: null, defaultAgeGroupId: 'default-age-group-id' });
            const notInDefaultAgeGroup = await createResponsibleMember({ groupDeletedAt: null });
            const organizationResponsibility = await createResponsibleMember({
                groupDeletedAt: null,
                // Not in the platform config
                responsibilityId: uuidv4(),
            });

            await FlagMomentCleanup.endResponsibilitiesOfUnregisteredMembers();

            expect(await isEnded(inDefaultAgeGroup)).toBe(false);
            expect(await isEnded(notInDefaultAgeGroup)).toBe(true);
            expect(await isEnded(organizationResponsibility)).toBe(false);
        });
    });
});
