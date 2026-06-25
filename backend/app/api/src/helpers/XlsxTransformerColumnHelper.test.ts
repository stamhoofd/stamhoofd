import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { PlatformMember } from '@stamhoofd/structures';
import {
    Group,
    GroupCategory,
    GroupCategorySettings,
    GroupSettings,
    MemberDetails,
    MembersBlob,
    MemberWithRegistrationsBlob,
    Organization,
    OrganizationRegistrationPeriod,
    OrganizationRegistrationPeriodSettings,
    Platform,
    PlatformFamily,
    Registration,
    RegistrationPeriod,
    TranslatedString,
} from '@stamhoofd/structures';
import { XlsxTransformerColumnHelper } from './XlsxTransformerColumnHelper.js';

describe('XlsxTransformerColumnHelper', () => {
    describe('createGroupCategoryColumns', () => {
        function createGroup(organization: Organization, periodId: string, name: string) {
            return Group.create({
                organizationId: organization.id,
                periodId,
                settings: GroupSettings.create({
                    name: new TranslatedString(name),
                }),
            });
        }

        function setup() {
            const period = RegistrationPeriod.create({});

            // Build the organization with two categories, each holding a few groups
            const organization = Organization.create({});

            const kapoenen = createGroup(organization, period.id, 'Kapoenen');
            const wouters = createGroup(organization, period.id, 'Wouters');
            const jonggivers = createGroup(organization, period.id, 'Jonggivers');
            const groepsleiding = createGroup(organization, period.id, 'Groepsleiding');
            const takleiding = createGroup(organization, period.id, 'Takleiding');

            const ageGroupsCategory = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Leeftijdsgroepen' }),
                groupIds: [kapoenen.id, wouters.id, jonggivers.id],
            });
            const leadershipCategory = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Leiding' }),
                groupIds: [groepsleiding.id, takleiding.id],
            });
            const root = GroupCategory.create({
                id: 'root',
                categoryIds: [ageGroupsCategory.id, leadershipCategory.id],
            });

            organization.period = OrganizationRegistrationPeriod.create({
                period,
                groups: [kapoenen, wouters, jonggivers, groepsleiding, takleiding],
                settings: OrganizationRegistrationPeriodSettings.create({
                    categories: [root, ageGroupsCategory, leadershipCategory],
                    rootCategoryId: root.id,
                }),
            });

            return { organization, period, ageGroupsCategory, leadershipCategory, groups: { kapoenen, wouters, jonggivers, groepsleiding, takleiding } };
        }

        function createMember(organization: Organization, registeredGroups: Group[]) {
            const blob = MembersBlob.create({
                organizations: [organization],
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({ firstName: 'John', lastName: 'Doe' }),
                        registrations: registeredGroups.map(group => Registration.create({
                            organizationId: organization.id,
                            group,
                            groupPrice: group.settings.prices[0],
                            registeredAt: new Date(),
                        })),
                    }),
                ],
            });

            const family = PlatformFamily.create(blob, { platform: Platform.create({}), contextOrganization: organization });
            return family.members[0];
        }

        function getColumn(categoryId: string): XlsxTransformerConcreteColumn<PlatformMember> {
            const column = XlsxTransformerColumnHelper.createGroupCategoryColumns<PlatformMember>({
                matchId: 'groupCategory',
                getMember: member => member,
            });

            if (!('match' in column)) {
                throw new Error('Expected a match column');
            }

            const matched = column.match(`groupCategory.${categoryId}`);
            expect(matched).toBeDefined();
            expect(matched).toHaveLength(1);
            return matched![0];
        }

        it('lists the groups a member is registered for within a category', () => {
            const { organization, ageGroupsCategory, leadershipCategory, groups } = setup();
            const member = createMember(organization, [groups.kapoenen, groups.jonggivers, groups.groepsleiding]);

            expect(getColumn(ageGroupsCategory.id).getValue(member).value).toBe('Jonggivers, Kapoenen');
            expect(getColumn(leadershipCategory.id).getValue(member).value).toBe('Groepsleiding');
        });

        it('returns an empty value when the member has no registrations in the category', () => {
            const { organization, leadershipCategory, groups } = setup();
            const member = createMember(organization, [groups.kapoenen]);

            expect(getColumn(leadershipCategory.id).getValue(member).value).toBe('');
        });

        it('does not match ids without a category id', () => {
            const column = XlsxTransformerColumnHelper.createGroupCategoryColumns<PlatformMember>({
                matchId: 'groupCategory',
                getMember: member => member,
            });

            if (!('match' in column)) {
                throw new Error('Expected a match column');
            }

            expect(column.match('groupCategory')).toBeUndefined();
            expect(column.match('groupCategory.')).toBeUndefined();
            expect(column.match('somethingElse.123')).toBeUndefined();
        });

        it('resolves groups in nested subcategories', () => {
            const period = RegistrationPeriod.create({});
            const organization = Organization.create({});

            const kapoenen = createGroup(organization, period.id, 'Kapoenen');
            const welpen = createGroup(organization, period.id, 'Welpen');

            const subCategory = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Jongste tak' }),
                groupIds: [welpen.id],
            });
            const ageGroupsCategory = GroupCategory.create({
                settings: GroupCategorySettings.create({ name: 'Leeftijdsgroepen' }),
                groupIds: [kapoenen.id],
                categoryIds: [subCategory.id],
            });
            const root = GroupCategory.create({ id: 'root', categoryIds: [ageGroupsCategory.id] });

            organization.period = OrganizationRegistrationPeriod.create({
                period,
                groups: [kapoenen, welpen],
                settings: OrganizationRegistrationPeriodSettings.create({
                    categories: [root, ageGroupsCategory, subCategory],
                    rootCategoryId: root.id,
                }),
            });

            const member = createMember(organization, [kapoenen, welpen]);

            expect(getColumn(ageGroupsCategory.id).getValue(member).value).toBe('Kapoenen, Welpen');
        });
    });
});
