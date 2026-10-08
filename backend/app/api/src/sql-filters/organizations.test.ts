import type { Endpoint } from '@simonbackx/simple-endpoints';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, RegistrationPeriod, User } from '@stamhoofd/models';
import { Email, MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, OrganizationTagFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import type { StamhoofdFilter } from '@stamhoofd/structures';
import { Company, LimitedFilteredRequest, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, SortItemDirection, STPackageBundle, STPackageType } from '@stamhoofd/structures';
import { EmailRecipientFilterType } from '@stamhoofd/structures/email/EmailRecipientFilterType.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../tests/helpers/TestServer.js';
import { GetEventNotificationsEndpoint } from '../endpoints/global/events/GetEventNotificationsEndpoint.js';
import { GetMembersEndpoint } from '../endpoints/global/members/GetMembersEndpoint.js';
import { GetRegistrationInvitationsEndpoint } from '../endpoints/global/registration-invitations/GetRegistrationInvitationsEndpoint.js';
import { GetRegistrationsEndpoint } from '../endpoints/global/registration/GetRegistrationsEndpoint.js';
import { GetWebshopsEndpoint } from '../endpoints/global/webshops/GetWebshopsEndpoint.js';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint.js';
import { GetReceivableBalancesEndpoint } from '../endpoints/organization/dashboard/receivable-balances/GetReceivableBalancesEndpoint.js';
import { ContextInstance } from '../helpers/Context.js';
import { SessionService } from '../services/SessionService.js';
import '../email-recipient-loaders/members.js';

const platformHost = 'platform.stamhoofd.app';
const fullPermissions = () => Permissions.create({ level: PermissionLevel.Full });

/**
 * One probe per relation that may only be used by platform admins.
 */
const relationProbes: Record<string, StamhoofdFilter> = {
    members: { $elemMatch: { email: { $contains: '@' } } },
    admins: { $elemMatch: { email: { $contains: '@' } } },
    companies: { $elemMatch: { name: { $contains: 'a' } } },
    packages: { $elemMatch: { type: STPackageType.Members } },
    documentTemplates: { $elemMatch: { year: 2023 } },
    setupSteps: { $elemMatch: { periodId: 'none' } },
    recordCategoryName: { $contains: 'a' },
    recordChildCategoryName: { $contains: 'a' },
    recordName: { $contains: 'a' },
};
const membersProbe: StamhoofdFilter = { members: relationProbes.members };

type AnyEndpoint = Endpoint<any, LimitedFilteredRequest, any, any>;

/**
 * Every path through which an organization can be reached from another object in a filter.
 */
const organizationPaths: { name: string; endpoint: AnyEndpoint; path: string; wrap: (organizationFilter: StamhoofdFilter) => StamhoofdFilter }[] = [
    { name: 'members.registrations.organization', endpoint: new GetMembersEndpoint(), path: '/members', wrap: f => ({ registrations: { $elemMatch: { organization: f } } }) },
    { name: 'members.responsibilities.organization', endpoint: new GetMembersEndpoint(), path: '/members', wrap: f => ({ responsibilities: { $elemMatch: { organization: f } } }) },
    { name: 'members.organizations', endpoint: new GetMembersEndpoint(), path: '/members', wrap: f => ({ organizations: { $elemMatch: f } }) },
    { name: 'registrations.organization', endpoint: new GetRegistrationsEndpoint(), path: '/registrations', wrap: f => ({ organization: f }) },
    { name: 'registrations.member.registrations.organization', endpoint: new GetRegistrationsEndpoint(), path: '/registrations', wrap: f => ({ member: { registrations: { $elemMatch: { organization: f } } } }) },
    { name: 'registration-invitations.member.registrations.organization', endpoint: new GetRegistrationInvitationsEndpoint(), path: '/registration-invitations', wrap: f => ({ member: { registrations: { $elemMatch: { organization: f } } } }) },
    { name: 'webshops.organization', endpoint: new GetWebshopsEndpoint(), path: '/webshops', wrap: f => ({ organization: f }) },
    { name: 'payments.payingOrganization', endpoint: new GetPaymentsEndpoint(), path: '/payments', wrap: f => ({ payingOrganization: f }) },
    { name: 'receivable-balances.organizations', endpoint: new GetReceivableBalancesEndpoint(), path: '/receivable-balances', wrap: f => ({ organizations: { $elemMatch: f } }) },
    { name: 'receivable-balances.members.registrations.organization', endpoint: new GetReceivableBalancesEndpoint(), path: '/receivable-balances', wrap: f => ({ members: { $elemMatch: { registrations: { $elemMatch: { organization: f } } } } }) },
    { name: 'event-notifications.organization', endpoint: new GetEventNotificationsEndpoint(), path: '/event-notifications', wrap: f => ({ organization: f }) },
];

const registrationOrganization = (organizationFilter: StamhoofdFilter) => ({ registrations: { $elemMatch: { organization: organizationFilter } } });

async function fetch(endpoint: AnyEndpoint, user: User, host: string, path: string, filter: StamhoofdFilter) {
    const token = await SessionService.createSession(user);
    return await testServer.test(endpoint, Request.get({
        path,
        host,
        query: new LimitedFilteredRequest({ filter, limit: 10 }),
        headers: { authorization: 'Bearer ' + token.accessToken },
    }));
}

async function fetchMemberIds(user: User, host: string, filter: StamhoofdFilter): Promise<string[]> {
    const response = await fetch(new GetMembersEndpoint(), user, host, '/members', filter);
    return response.body.results.members.map(m => m.id);
}

describe('Organization relation filters', () => {
    let period: RegistrationPeriod;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    beforeAll(async () => {
        period = await new RegistrationPeriodFactory({
            startDate: new Date(2023, 0, 1),
            endDate: new Date(2023, 11, 31),
        }).create();
    });

    describe('Users without platform access', () => {
        let organization: Organization;
        let organizationAdmin: User;

        beforeEach(async () => {
            organization = await new OrganizationFactory({ period }).create();
            organizationAdmin = await new UserFactory({ organization, permissions: fullPermissions() }).create();
        });

        const expectDenied = (endpoint: AnyEndpoint, user: User, host: string, path: string, filter: StamhoofdFilter) =>
            expect(fetch(endpoint, user, host, path, filter)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));

        test('An organization admin is denied on every path that reaches an organization', async () => {
            for (const { endpoint, path, wrap } of organizationPaths) {
                await expectDenied(endpoint, organizationAdmin, organization.getApiHost(), path, wrap(membersProbe));
            }
        });

        test('An organization admin is denied for every relation of the organization', async () => {
            const endpoint = new GetMembersEndpoint();
            const host = organization.getApiHost();

            // The organization itself stays filterable
            const response = await fetch(endpoint, organizationAdmin, host, '/members', registrationOrganization({ name: organization.name }));
            expect(response.status).toBe(200);

            for (const [key, probe] of Object.entries(relationProbes)) {
                await expectDenied(endpoint, organizationAdmin, host, '/members', registrationOrganization({ [key]: probe }));
            }
        });

        test('Alternative filter syntaxes cannot bypass the check', async () => {
            const endpoint = new GetMembersEndpoint();
            const host = organization.getApiHost();
            const nested = registrationOrganization(membersProbe);

            const variants: StamhoofdFilter[] = [
                { 'registrations.organization.members': relationProbes.members },
                { registrations: { $elemMatch: { 'organization.members': relationProbes.members } } },
                { $or: [{ firstName: 'nobody' }, nested] },
                { $and: [nested] },
                { $not: nested },
                registrationOrganization({ $or: [{ name: 'nobody' }, membersProbe] }),
                registrationOrganization({ $not: membersProbe }),
            ];

            for (const variant of variants) {
                await expectDenied(endpoint, organizationAdmin, host, '/members', variant);
            }
        });

        test('Users without permissions are denied', async () => {
            const memberUser = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.None }) }).create();
            const platformUser = await new UserFactory({}).create();

            for (const { endpoint, path, wrap } of organizationPaths) {
                await expectDenied(endpoint, memberUser, organization.getApiHost(), path, wrap(membersProbe));
            }
            await expectDenied(new GetMembersEndpoint(), platformUser, platformHost, '/members', registrationOrganization(membersProbe));
            await expectDenied(new GetWebshopsEndpoint(), platformUser, platformHost, '/webshops', { organization: membersProbe });
        });

        test('Email recipient loaders apply the same check for the user that created the email', async () => {
            // Members only have their own email address from the age of 16
            const member = await new MemberFactory({ minAge: 18 }).create();
            await new RegistrationFactory({ member, organization }).create();
            await new MemberResponsibilityRecordFactory({ member, organizationId: organization.id }).create();
            const platformAdmin = await new UserFactory({ globalPermissions: fullPermissions() }).create();

            const loader = Email.recipientLoaders.get(EmailRecipientFilterType.Members)!;
            const buildRequest = () => new LimitedFilteredRequest({
                filter: { id: member.id, responsibilities: { $elemMatch: { endDate: null, organization: { members: relationProbes.members } } } },
                sort: [{ key: 'id', order: SortItemDirection.ASC }],
                limit: 100,
            });

            await expect(ContextInstance.startForUser(organizationAdmin, organization, () => loader.count(buildRequest(), null))).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );
            await expect(ContextInstance.startForUser(organizationAdmin, organization, () => loader.fetch(buildRequest(), null))).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );

            const result = await ContextInstance.startForUser(platformAdmin, null, () => loader.fetch(buildRequest(), null));
            // One recipient per email address of the member
            expect([...new Set(result.results.map(r => r.memberId))]).toEqual([member.id]);
        });
    });

    describe('Tag-limited platform admins', () => {
        test('Organizations outside their tags are never matched through any relation', async () => {
            const tag = await new OrganizationTagFactory({}).create();
            // With a single tag in the platform, access to that tag equals access to all organizations
            await new OrganizationTagFactory({}).create();

            const taggedOrganization = await new OrganizationFactory({ period, tags: [tag.id] }).create();
            const otherOrganization = await new OrganizationFactory({ period, packages: [STPackageBundle.Members] }).create();
            const companyName = 'Company ' + tag.id;
            otherOrganization.meta.companies = [Company.create({ name: companyName })];
            await otherOrganization.save();

            // Registered in both organizations, so the member is visible to the tag admin
            const member = await new MemberFactory({}).create();
            await new RegistrationFactory({ member, organization: taggedOrganization }).create();
            await new RegistrationFactory({ member, organization: otherOrganization }).create();
            await new MemberResponsibilityRecordFactory({ member, organizationId: taggedOrganization.id }).create();
            await new MemberResponsibilityRecordFactory({ member, organizationId: otherOrganization.id }).create();

            const taggedMember = await new MemberFactory({ firstName: 'Tagged ' + tag.id }).create();
            await new RegistrationFactory({ member: taggedMember, organization: taggedOrganization }).create();
            const otherMember = await new MemberFactory({ firstName: 'Other ' + tag.id }).create();
            await new RegistrationFactory({ member: otherMember, organization: otherOrganization }).create();

            const platformAdmin = await new UserFactory({ globalPermissions: fullPermissions() }).create();
            const tagAdmin = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.OrganizationTags,
                        new Map([[tag.id, ResourcePermissions.create({ level: PermissionLevel.Read })]]),
                    ]]),
                }),
            }).create();

            const fellowMember = (firstName: string): StamhoofdFilter => ({ members: { $elemMatch: { firstName } } });
            const paths: ((organizationFilter: StamhoofdFilter) => StamhoofdFilter)[] = [
                f => ({ id: member.id, registrations: { $elemMatch: { organization: f } } }),
                f => ({ id: member.id, responsibilities: { $elemMatch: { organization: f } } }),
                f => ({ id: member.id, organizations: { $elemMatch: f } }),
            ];

            for (const wrap of paths) {
                expect(await fetchMemberIds(platformAdmin, platformHost, wrap(fellowMember(otherMember.firstName)))).toEqual([member.id]);
                expect(await fetchMemberIds(tagAdmin, platformHost, wrap(fellowMember(taggedMember.firstName)))).toEqual([member.id]);
                expect(await fetchMemberIds(tagAdmin, platformHost, wrap(fellowMember(otherMember.firstName)))).toEqual([]);
            }

            // Relations that read the organization row itself instead of a joined table
            const otherOrganizationOnly: StamhoofdFilter[] = [
                { companies: { $elemMatch: { name: companyName } } },
                { packages: relationProbes.packages },
            ];
            for (const organizationFilter of otherOrganizationOnly) {
                expect(await fetchMemberIds(platformAdmin, platformHost, paths[0](organizationFilter))).toEqual([member.id]);
                expect(await fetchMemberIds(tagAdmin, platformHost, paths[0](organizationFilter))).toEqual([]);
            }
        });

        test('Negated relation filters do not reveal anything about organizations outside their tags', async () => {
            const tag = await new OrganizationTagFactory({}).create();
            await new OrganizationTagFactory({}).create();

            const taggedOrganization = await new OrganizationFactory({ period, tags: [tag.id] }).create();
            const otherOrganization = await new OrganizationFactory({ period }).create();
            const member = await new MemberFactory({}).create();
            await new RegistrationFactory({ member, organization: taggedOrganization }).create();
            await new RegistrationFactory({ member, organization: otherOrganization }).create();
            const otherMember = await new MemberFactory({ firstName: 'Other ' + tag.id }).create();
            await new RegistrationFactory({ member: otherMember, organization: otherOrganization }).create();

            const tagAdmin = await new UserFactory({
                globalPermissions: Permissions.create({
                    level: PermissionLevel.None,
                    resources: new Map([[
                        PermissionsResourceType.OrganizationTags,
                        new Map([[tag.id, ResourcePermissions.create({ level: PermissionLevel.Read })]]),
                    ]]),
                }),
            }).create();

            const negations: ((firstName: string) => StamhoofdFilter)[] = [
                firstName => ({ id: member.id, registrations: { $elemMatch: { organization: { $not: { members: { $elemMatch: { firstName } } } } } } }),
                firstName => ({ id: member.id, $not: { registrations: { $elemMatch: { organization: { members: { $elemMatch: { firstName } } } } } } }),
            ];

            // A real and a fake name must give the same answer, otherwise the tag admin could probe members of the other organization
            for (const negate of negations) {
                const real = await fetchMemberIds(tagAdmin, platformHost, negate(otherMember.firstName));
                const fake = await fetchMemberIds(tagAdmin, platformHost, negate('Nobody ' + tag.id));
                expect(real).toEqual(fake);
            }
        });
    });
});
