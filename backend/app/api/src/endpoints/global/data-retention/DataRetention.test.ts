import type { Endpoint } from '@node/endpoints';
import { Request } from '@node/endpoints';
import type { Organization, Token, User } from '@stamhoofd/models';
import { AuditLog, DataRetentionPolicy, OrganizationFactory, Platform, UserFactory } from '@stamhoofd/models';
import type { DataRetentionSettings } from '@stamhoofd/structures';
import { AuditLogType, DataRetentionCategory, Permissions, Version } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { DeleteDataRetentionPendingEndpoint } from './DeleteDataRetentionPendingEndpoint.js';
import { GetDataRetentionEndpoint } from './GetDataRetentionEndpoint.js';
import { PatchDataRetentionEndpoint } from './PatchDataRetentionEndpoint.js';

const getEndpoint = new GetDataRetentionEndpoint();
const patchEndpoint = new PatchDataRetentionEndpoint();
const deleteEndpoint = new DeleteDataRetentionPendingEndpoint();

const DAY = 24 * 60 * 60 * 1000;

type Terms = { anonymizeAfterMonths?: number | null; deleteAfterMonths?: number | null; protectedPeriods?: number | null };

function fullTerms(terms: Terms) {
    return { anonymizeAfterMonths: null, deleteAfterMonths: null, protectedPeriods: null, ...terms };
}

async function send<T>(endpoint: Endpoint<any, any, any, any>, method: 'GET' | 'PATCH' | 'DELETE', path: string, host: string, token: Token, body?: unknown) {
    const request = Request.buildJson(method, `/v${Version}${path}`, host, body);
    request.headers.authorization = 'Bearer ' + token.accessToken;
    return await testServer.test(endpoint, request) as unknown as { body: T };
}

function patch(host: string, token: Token, category: DataRetentionCategory, terms: Terms) {
    return send<DataRetentionSettings>(patchEndpoint, 'PATCH', '/data-retention', host, token, { category, terms: fullTerms(terms) });
}

function getPolicy(settings: DataRetentionSettings, category: DataRetentionCategory) {
    return settings.policies.find(p => p.category === category)!;
}

async function fresh(user: User) {
    return await SessionService.createSession(user, { authenticatedAt: new Date() });
}

async function initOrganization() {
    const organization = await new OrganizationFactory({}).create();
    organization.privateMeta.featureFlags = ['data-retention'];
    await organization.save();
    const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
    return { organization, admin, token: await fresh(admin), host: organization.getApiHost() };
}

async function initPlatform() {
    const platform = await Platform.getForEditing();
    platform.config.featureFlags = ['data-retention'];
    await platform.save();
    const admin = await new UserFactory({ globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
    return { admin, token: await fresh(admin), host: STAMHOOFD.domains.api };
}

async function setPlatformTerms(terms: Terms) {
    const policy = new DataRetentionPolicy();
    policy.tenantId = '1';
    policy.category = DataRetentionCategory.Members;
    policy.anonymizeAfterMonths = terms.anonymizeAfterMonths ?? null;
    policy.deleteAfterMonths = terms.deleteAfterMonths ?? null;
    policy.protectedPeriods = terms.protectedPeriods ?? null;
    await policy.save();
}

async function getLogs(organization: Organization | null, type: AuditLogType) {
    return await AuditLog.select().where('organizationId', organization?.id ?? null).where('type', type).fetch();
}

describe('Endpoint.DataRetention', () => {
    beforeEach(async () => {
        await DataRetentionPolicy.delete();
        TestUtils.setEnvironment('userMode', 'platform');
    });

    afterEach(async () => {
        const platform = await Platform.getForEditing();
        platform.config.featureFlags = [];
        await platform.save();
    });

    describe('Access', () => {
        test('It is not available without the feature flag', async () => {
            const { organization, token, host } = await initOrganization();
            organization.privateMeta.featureFlags = [];
            await organization.save();

            await expect(send(getEndpoint, 'GET', '/data-retention', host, token))
                .rejects.toThrow(STExpect.simpleError({ code: 'not_available' }));
        });

        test('An administrator without full access cannot view or change terms', async () => {
            const { organization, host } = await initOrganization();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Write }) }).create();
            const token = await fresh(admin);

            await expect(send(getEndpoint, 'GET', '/data-retention', host, token))
                .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
            await expect(patch(host, token, DataRetentionCategory.Members, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
        });

        test('An administrator of another organization has no access', async () => {
            const { host } = await initOrganization();
            const other = await initOrganization();

            await expect(patch(host, other.token, DataRetentionCategory.Members, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
            expect(await DataRetentionPolicy.select().count()).toBe(0);
        });

        test('An organization administrator cannot change the terms of the platform', async () => {
            await initPlatform();
            const { token } = await initOrganization();

            await expect(patch(STAMHOOFD.domains.api, token, DataRetentionCategory.Members, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'permission_denied' }));
        });

        test('A full platform administrator can change the terms of an organization', async () => {
            const { organization, host } = await initOrganization();
            const { token } = await initPlatform();

            await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            expect((await DataRetentionPolicy.getFor('1', organization.id, DataRetentionCategory.Emails))?.pendingDeleteAfterMonths).toBe(24);
        });

        test('Changing a term needs a fresh authentication, viewing does not', async () => {
            const { admin, host } = await initOrganization();
            const stale = await SessionService.createSession(admin);

            await expect(patch(host, stale, DataRetentionCategory.Members, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'require_fresh_auth' }));
            await expect(send(getEndpoint, 'GET', '/data-retention', host, stale)).resolves.toBeDefined();
        });

        test('Also a longer term needs a fresh authentication', async () => {
            const { admin, token, host } = await initOrganization();
            await patch(host, token, DataRetentionCategory.Members, { deleteAfterMonths: 24 });
            const stale = await SessionService.createSession(admin);

            await expect(patch(host, stale, DataRetentionCategory.Members, { deleteAfterMonths: 48 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'require_fresh_auth' }));
        });

        test('An API key cannot change a term', async () => {
            const { organization, host } = await initOrganization();
            const apiUser = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }), apiUser: true }).create();

            await expect(patch(host, await SessionService.createApiSession(apiUser), DataRetentionCategory.Members, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'require_fresh_auth' }));
        });

        test('An impersonated session cannot change a term', async () => {
            const { organization, admin, host } = await initOrganization();
            const other = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            await expect(patch(host, await SessionService.createImpersonationSession(admin, other), DataRetentionCategory.Members, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'not_allowed_while_impersonating' }));
        });
    });

    describe('Get', () => {
        test('A platform gets the default protection, and all categories', async () => {
            const { token, host } = await initPlatform();

            const { body } = await send<DataRetentionSettings>(getEndpoint, 'GET', '/data-retention', host, token);

            expect(getPolicy(body, DataRetentionCategory.Members).terms.protectedPeriods).toBe(2);
            expect(getPolicy(body, DataRetentionCategory.Accounts)).toBeDefined();
            expect(body.platformPolicies).toEqual([]);
        });

        test('An organization within a platform also sees the terms of the platform, but not accounts', async () => {
            const { token, host } = await initOrganization();
            await setPlatformTerms({ deleteAfterMonths: 36 });

            const { body } = await send<DataRetentionSettings>(getEndpoint, 'GET', '/data-retention', host, token);

            expect(getPolicy(body, DataRetentionCategory.Members).terms.protectedPeriods).toBeNull();
            expect(getPolicy(body, DataRetentionCategory.Accounts)).toBeUndefined();
            expect(body.platformPolicies.find(p => p.category === DataRetentionCategory.Members)?.terms.deleteAfterMonths).toBe(36);
        });

        test('An organization without a platform gets the default protection, and accounts', async () => {
            TestUtils.setEnvironment('userMode', 'organization');
            const { token, host } = await initOrganization();

            const { body } = await send<DataRetentionSettings>(getEndpoint, 'GET', '/data-retention', host, token);

            expect(getPolicy(body, DataRetentionCategory.Members).terms.protectedPeriods).toBe(2);
            expect(getPolicy(body, DataRetentionCategory.Accounts)).toBeDefined();
            expect(body.platformPolicies).toEqual([]);
        });
    });

    describe('Waiting', () => {
        test('A first term waits 30 days', async () => {
            const { token, host } = await initOrganization();
            const before = Date.now();

            const { body } = await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            const policy = getPolicy(body, DataRetentionCategory.Emails);
            expect(policy.terms.deleteAfterMonths).toBeNull();
            expect(policy.pendingTerms?.deleteAfterMonths).toBe(24);
            expect(policy.pendingFrom!.getTime()).toBeGreaterThan(before + 29 * DAY);
            expect(policy.pendingFrom!.getTime()).toBeLessThan(Date.now() + 31 * DAY);
        });

        test('A longer term applies immediately and replaces a pending change', async () => {
            const { organization, token, host } = await initOrganization();
            const saved = new DataRetentionPolicy();
            saved.tenantId = '1';
            saved.organizationId = organization.id;
            saved.category = DataRetentionCategory.Emails;
            saved.deleteAfterMonths = 24;
            saved.pendingDeleteAfterMonths = 12;
            saved.pendingFrom = new Date(Date.now() + 10 * DAY);
            await saved.save();

            const { body } = await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 48 });

            const policy = getPolicy(body, DataRetentionCategory.Emails);
            expect(policy.terms.deleteAfterMonths).toBe(48);
            expect(policy.pendingTerms).toBeNull();
        });

        test('Saving the same pending change again does not restart the wait', async () => {
            const { token, host } = await initOrganization();

            const first = await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });
            const second = await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            expect(getPolicy(second.body, DataRetentionCategory.Emails).pendingFrom).toEqual(getPolicy(first.body, DataRetentionCategory.Emails).pendingFrom);
        });

        test('A pending change that is due counts as the current term', async () => {
            const { organization, token, host } = await initOrganization();
            const saved = new DataRetentionPolicy();
            saved.tenantId = '1';
            saved.organizationId = organization.id;
            saved.category = DataRetentionCategory.Emails;
            saved.deleteAfterMonths = 48;
            saved.pendingDeleteAfterMonths = 12;
            saved.pendingFrom = new Date(Date.now() - DAY);
            await saved.save();

            const { body } = await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            const policy = getPolicy(body, DataRetentionCategory.Emails);
            expect(policy.terms.deleteAfterMonths).toBe(24);
            expect(policy.pendingTerms).toBeNull();
        });

        test('An organization can always save a shorter term than the platform, which then changes nothing yet', async () => {
            const { token, host } = await initOrganization();
            await setPlatformTerms({ deleteAfterMonths: 36 });

            const { body } = await patch(host, token, DataRetentionCategory.Members, { deleteAfterMonths: 12, protectedPeriods: 1 });

            const policy = getPolicy(body, DataRetentionCategory.Members);
            expect(policy.terms.deleteAfterMonths).toBe(12);
            expect(policy.terms.protectedPeriods).toBe(1);
            expect(policy.pendingTerms).toBeNull();
        });

        test('An organization that conflicts with the platform can still save', async () => {
            const { token, host } = await initOrganization();
            await setPlatformTerms({ deleteAfterMonths: 36 });

            const { body } = await patch(host, token, DataRetentionCategory.Members, { anonymizeAfterMonths: 60 });

            expect(getPolicy(body, DataRetentionCategory.Members).pendingTerms?.anonymizeAfterMonths).toBe(60);
        });

        test('An organization that removes its longer term waits when the platform has a shorter term', async () => {
            const { organization, token, host } = await initOrganization();
            await setPlatformTerms({ deleteAfterMonths: 24 });
            const saved = new DataRetentionPolicy();
            saved.tenantId = '1';
            saved.organizationId = organization.id;
            saved.category = DataRetentionCategory.Members;
            saved.deleteAfterMonths = 60;
            await saved.save();

            const { body } = await patch(host, token, DataRetentionCategory.Members, {});

            const policy = getPolicy(body, DataRetentionCategory.Members);
            expect(policy.terms.deleteAfterMonths).toBe(60);
            expect(policy.pendingTerms?.deleteAfterMonths).toBeNull();
            expect(policy.pendingFrom).not.toBeNull();
        });

        test('A platform that removes its term waits, an organization without a platform does not', async () => {
            const { token, host } = await initPlatform();
            await setPlatformTerms({ deleteAfterMonths: 24 });

            const { body } = await patch(host, token, DataRetentionCategory.Members, {});
            expect(getPolicy(body, DataRetentionCategory.Members).pendingFrom).not.toBeNull();

            TestUtils.setEnvironment('userMode', 'organization');
            const organization = await initOrganization();
            const saved = new DataRetentionPolicy();
            saved.tenantId = '1';
            saved.organizationId = organization.organization.id;
            saved.category = DataRetentionCategory.Emails;
            saved.deleteAfterMonths = 24;
            await saved.save();

            const result = await patch(organization.host, organization.token, DataRetentionCategory.Emails, {});
            expect(getPolicy(result.body, DataRetentionCategory.Emails).terms.deleteAfterMonths).toBeNull();
            expect(getPolicy(result.body, DataRetentionCategory.Emails).pendingFrom).toBeNull();
        });

        test('Lowering the default protection of the platform waits', async () => {
            const { token, host } = await initPlatform();

            const { body } = await patch(host, token, DataRetentionCategory.Members, { protectedPeriods: 1 });

            const policy = getPolicy(body, DataRetentionCategory.Members);
            expect(policy.terms.protectedPeriods).toBe(2);
            expect(policy.pendingTerms?.protectedPeriods).toBe(1);
        });
    });

    describe('Validation', () => {
        test.each([
            { name: 'negative term', terms: { deleteAfterMonths: -6 }, field: 'deleteAfterMonths' },
            { name: 'negative protected periods', terms: { protectedPeriods: -1 }, field: 'protectedPeriods' },
            { name: 'too short term', terms: { anonymizeAfterMonths: 2 }, field: 'anonymizeAfterMonths' },
            { name: 'too long term', terms: { deleteAfterMonths: 241 }, field: 'deleteAfterMonths' },
            { name: 'delete before anonymize', terms: { anonymizeAfterMonths: 24, deleteAfterMonths: 12 }, field: 'deleteAfterMonths' },
        ])('It refuses a $name', async ({ terms, field }) => {
            const { token, host } = await initOrganization();

            await expect(patch(host, token, DataRetentionCategory.Members, terms))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field }));
            expect(await DataRetentionPolicy.select().count()).toBe(0);
        });

        test('It refuses text as a number', async () => {
            const { token, host } = await initOrganization();

            await expect(send(patchEndpoint, 'PATCH', '/data-retention', host, token, { category: DataRetentionCategory.Members, terms: fullTerms({ deleteAfterMonths: '12abc' as unknown as number }) }))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field' }));
        });

        test('It refuses an action the category does not support', async () => {
            const { token, host } = await initOrganization();

            await expect(patch(host, token, DataRetentionCategory.Orders, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'deleteAfterMonths' }));
        });

        test('An organization within a platform cannot set accounts', async () => {
            const { token, host } = await initOrganization();

            await expect(patch(host, token, DataRetentionCategory.Accounts, { deleteAfterMonths: 24 }))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'category' }));
        });
    });

    describe('Cancel', () => {
        test('A pending change can be cancelled without a fresh authentication', async () => {
            const { admin, token, host } = await initOrganization();
            await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });
            const stale = await SessionService.createSession(admin);

            const { body } = await send<DataRetentionSettings>(deleteEndpoint, 'DELETE', `/data-retention/pending/${DataRetentionCategory.Emails}`, host, stale);

            const policy = getPolicy(body, DataRetentionCategory.Emails);
            expect(policy.pendingTerms).toBeNull();
            expect(policy.terms.deleteAfterMonths).toBeNull();
        });

        test('It fails when nothing is waiting', async () => {
            const { token, host } = await initOrganization();

            await expect(send(deleteEndpoint, 'DELETE', `/data-retention/pending/${DataRetentionCategory.Emails}`, host, token))
                .rejects.toThrow(STExpect.simpleError({ code: 'not_found' }));
        });

        test('It refuses an unknown category', async () => {
            const { token, host } = await initOrganization();

            await expect(send(deleteEndpoint, 'DELETE', '/data-retention/pending/Unknown', host, token))
                .rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'category' }));
        });
    });

    describe('Audit log', () => {
        test('A change is logged with the values, and the name and email of the administrator', async () => {
            const { organization, admin, token, host } = await initOrganization();

            const { body } = await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            const [log, ...others] = await getLogs(organization, AuditLogType.DataRetentionPolicyChanged);
            expect(others).toHaveLength(0);
            expect(log.userId).toBe(admin.id);
            expect(log.replacements.get('u')?.value).toContain(admin.email);
            expect(log.replacements.get('category')?.value).toBe(DataRetentionCategory.Emails);
            expect(log.replacements.get('after')?.value).toBeTruthy();
            expect(log.replacements.get('from')?.value).toBeTruthy();
            expect(getPolicy(body, DataRetentionCategory.Emails).pendingFrom).not.toBeNull();
        });

        test('Saving without a change does not log', async () => {
            const { organization, token, host } = await initOrganization();

            await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });
            await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });
            await patch(host, token, DataRetentionCategory.Orders, {});

            expect(await getLogs(organization, AuditLogType.DataRetentionPolicyChanged)).toHaveLength(1);
        });

        test('A platform change is logged without an organization', async () => {
            const { admin, token, host } = await initPlatform();

            await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            const logs = await AuditLog.select().where('userId', admin.id).where('type', AuditLogType.DataRetentionPolicyChanged).fetch();
            expect(logs).toHaveLength(1);
            expect(logs[0].organizationId).toBeNull();
        });

        test('Cancelling is logged', async () => {
            const { organization, token, host } = await initOrganization();
            await patch(host, token, DataRetentionCategory.Emails, { deleteAfterMonths: 24 });

            await send(deleteEndpoint, 'DELETE', `/data-retention/pending/${DataRetentionCategory.Emails}`, host, token);

            expect(await getLogs(organization, AuditLogType.DataRetentionPendingChangeCancelled)).toHaveLength(1);
        });
    });
});
