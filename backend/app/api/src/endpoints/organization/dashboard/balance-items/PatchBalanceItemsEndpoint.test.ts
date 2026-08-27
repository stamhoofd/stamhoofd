import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { AuditLog, BalanceItemFactory, MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { AuditLogReplacementType, AuditLogSource, AuditLogType, BalanceItemStatus, BalanceItemWithPayments, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { testServer } from '../../../../../tests/helpers/TestServer.js';
import '../../../../audit-logs/init.js';
import { AuditLogService } from '../../../../services/AuditLogService.js';
import { SessionService } from '../../../../services/SessionService.js';
import { PatchBalanceItemsEndpoint } from './PatchBalanceItemsEndpoint.js';

describe('Endpoint.PatchBalanceItemsEndpoint', () => {
    const endpoint = new PatchBalanceItemsEndpoint();

    const patchBalanceItems = async ({ body, organization, user }: { body: PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>; organization: Organization; user: User }) => {
        const token = await SessionService.createSession(user);
        const request = Request.buildJson('PATCH', '/organization/balance', organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    };

    beforeAll(() => {
        AuditLogService.listen();
    });

    describe('Audit logs', () => {
        test('creating a balance item is logged with the member as payer', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const member = await new MemberFactory({ organization }).create();

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPut(BalanceItemWithPayments.create({
                description: 'Kampgeld',
                unitPrice: 25_00,
                amount: 2,
                memberId: member.id,
            }));

            const response = await patchBalanceItems({ body, organization, user: admin });
            expect(response.body).toHaveLength(1);
            const balanceItemId = response.body[0].id;

            const logs = await AuditLog.select().where('type', AuditLogType.BalanceItemAdded).where('objectId', balanceItemId).fetch();
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.userId).toBe(admin.id);
            expect(log.organizationId).toBe(organization.id);
            expect(log.source).toBe(AuditLogSource.User);
            expect(log.replacements.get('b')).toMatchObject({ id: balanceItemId, value: 'Kampgeld', type: AuditLogReplacementType.BalanceItem });
            expect(log.replacements.get('payer')).toMatchObject({ id: member.id, value: member.details.name, type: AuditLogReplacementType.Member });
            expect(log.description).toContain('Bedrag');
        });

        test('editing a balance item logs the changed fields, not cached prices', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const member = await new MemberFactory({ organization }).create();
            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                description: 'Kampgeld',
                unitPrice: 25_00,
                amount: 1,
                createdAt: new Date(Date.now() - 60_000),
            }).create();

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPatch(BalanceItemWithPayments.patch({
                id: balanceItem.id,
                description: 'Weekendgeld',
                unitPrice: 30_00,
                status: BalanceItemStatus.Canceled,
            }));

            await patchBalanceItems({ body, organization, user: admin });

            const logs = await AuditLog.select().where('type', AuditLogType.BalanceItemEdited).where('objectId', balanceItem.id).fetch();
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.replacements.get('b')).toMatchObject({ id: balanceItem.id, value: 'Weekendgeld', type: AuditLogReplacementType.BalanceItem });

            const keys = log.patchList.map(p => p.key.toKey());
            expect(keys).toEqual(expect.arrayContaining(['description', 'unitPrice', 'status']));
            expect(keys).not.toEqual(expect.arrayContaining(['priceTotal']));
            expect(keys).not.toEqual(expect.arrayContaining(['priceOpen']));

            const statusChange = log.patchList.find(p => p.key.toKey() === 'status');
            expect(statusChange?.oldValue).toMatchObject({ id: 'BalanceItemStatus', value: BalanceItemStatus.Due, type: AuditLogReplacementType.Enum });
            expect(statusChange?.value).toMatchObject({ id: 'BalanceItemStatus', value: BalanceItemStatus.Canceled, type: AuditLogReplacementType.Enum });
        });

        test('a balance item paid by an organization uses that organization as payer', async () => {
            const organization = await new OrganizationFactory({}).create();
            const payingOrganization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ globalPermissions: Permissions.create({ level: PermissionLevel.Full }) }).create();

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPut(BalanceItemWithPayments.create({
                description: 'Lidgeld',
                unitPrice: 10_00,
                amount: 1,
                payingOrganizationId: payingOrganization.id,
            }));

            const response = await patchBalanceItems({ body, organization, user: admin });

            const logs = await AuditLog.select().where('type', AuditLogType.BalanceItemAdded).where('objectId', response.body[0].id).fetch();
            expect(logs).toHaveLength(1);
            expect(logs[0].organizationId).toBe(organization.id);
            expect(logs[0].replacements.get('payer')).toMatchObject({ id: payingOrganization.id, value: payingOrganization.name, type: AuditLogReplacementType.Organization });
        });
    });
});
