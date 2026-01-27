import {
    Group,
    Organization,
    OrganizationRegistrationPeriod,
    OrganizationRegistrationPeriodFactory,
    RegistrationPeriod,
    RegistrationPeriodFactory,
} from '@stamhoofd/models';
import {
    GroupCategory,
    GroupCategorySettings,
    OrganizationMetaData,
    OrganizationRecordsConfiguration,
    PropertyFilter,
} from '@stamhoofd/structures';
import { TestGroups } from './TestGroups';

export type OrganizationContext = {
    organization: Organization;
    periods: RegistrationPeriod[];
    organizationPeriods: OrganizationRegistrationPeriod[];
};

export type YouthOrganization1Context = OrganizationContext & {
    groups: {
        bevers: Group;
        welpen: Group;
        leiding: Group;
    };
    categories: {
        takken: GroupCategory;
        vrijwilligers: GroupCategory;
    };
};

/**
 * Helper methods to create data for an organization:
 * - organization
 * - periods
 * - categories
 * - groups
 *
 * Modify the data to fit your needs after initialization.
 */
export class TestOrganizations {
    /**
     *
     * @param organization default organization for worker
     * @returns
     */
    static async youthOrganization1(organization: Organization): Promise<YouthOrganization1Context> {
        // organization
        organization.meta = OrganizationMetaData.create({
            recordsConfiguration: OrganizationRecordsConfiguration.create({
                financialSupport: true,
                uitpasNumber: new PropertyFilter(null, null),
            }),
        });

        // period
        const period = await new RegistrationPeriodFactory({
            startDate: new Date('2000-01-01'),
            endDate: new Date('2001-01-01'),
            organization,
        }).create();

        const organizationPeriod
            = await new OrganizationRegistrationPeriodFactory({
                period,
                organization,
            }).create();

        organization.periodId = period.id;

        // categories
        const takken = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [],
        });

        const vrijwilligers = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Leiding' }),
            groupIds: [],
        });

        organizationPeriod.settings.categories.push(takken, vrijwilligers);

        // groups
        const bevers = await TestGroups.defaultGroup('Bevers')(organization);
        const welpen = await TestGroups.defaultGroup('Welpen')(organization);
        takken.groupIds.push(bevers.id, welpen.id);

        const leiding = await TestGroups.defaultGroup('Leiding')(organization);
        vrijwilligers.groupIds.push(leiding.id);

        organizationPeriod.settings.rootCategory?.categoryIds.push(
            takken.id,
            vrijwilligers.id,
        );

        await organizationPeriod.save();

        await organization.save();

        return {
            organization,
            periods: [period],
            organizationPeriods: [organizationPeriod],
            categories: {
                takken,
                vrijwilligers,
            },
            groups: {
                bevers,
                welpen,
                leiding,
            },
        };
    }
}
