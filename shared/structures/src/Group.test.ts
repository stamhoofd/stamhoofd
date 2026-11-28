import { TestUtils } from '@stamhoofd/test-utils';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilter';
import { Event } from './Event.js';
import { Group } from './Group.js';
import { GroupType } from './GroupType.js';
import { RegistrationPeriod } from './RegistrationPeriod.js';

describe('Group.getRecommendedFilter', () => {
    const period = RegistrationPeriod.create({
        startDate: new Date(2026, 8, 1),
        endDate: new Date(2027, 7, 31),
    });

    const organization = {
        id: 'organization-id',
        name: 'Organization name',
        period: { period },
    };

    function createEventGroup(eventOrganizationId: string | null) {
        const group = Group.create({
            type: GroupType.EventRegistration,
            organizationId: organization.id,
            periodId: period.id,
        });
        group.event = Event.create({
            organizationId: eventOrganizationId,
            group,
        });
        return group;
    }

    function getOrganizationIdFilters(filter: StamhoofdFilter) {
        return (filter as any[])
            .flatMap((f) => f?.registrations?.$elemMatch?.$and ?? [])
            .filter((f) => f.organizationId !== undefined)
            .map((f) => f.organizationId);
    }

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    it('filters on the organization with a named relation value', () => {
        const group = createEventGroup(organization.id);
        const filter = group.getRecommendedFilter(organization);

        expect(getOrganizationIdFilters(filter)).toEqual([
            {
                $: '$rel',
                value: organization.id,
                name: organization.name,
            },
        ]);
    });

    it('does not filter on the organization for national activities', () => {
        const group = createEventGroup(null);
        const filter = group.getRecommendedFilter(organization);

        expect(getOrganizationIdFilters(filter)).toEqual([]);
    });

    it('keeps required organizations for national activities', () => {
        const group = createEventGroup(null);
        group.settings.requireOrganizationIds = [organization.id, 'other-organization-id'];
        const filter = group.getRecommendedFilter(organization);

        expect(getOrganizationIdFilters(filter)).toEqual([
            { $in: [organization.id, 'other-organization-id'] },
        ]);
    });
});
