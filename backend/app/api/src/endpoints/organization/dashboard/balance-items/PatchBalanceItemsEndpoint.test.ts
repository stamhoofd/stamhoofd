import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { Organization, User } from '@stamhoofd/models';
import { AuditLog, BalanceItem, BalanceItemFactory, GroupFactory, MemberFactory, OrganizationFactory, RegistrationFactory, RegistrationPeriodFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight, AuditLogReplacementType, AuditLogSource, AuditLogType, BalanceItemStatus, BalanceItemType, BalanceItemWithPayments, PermissionLevel, PermissionRoleDetailed, Permissions, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
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

    describe('Description', () => {
        test('a balance item can be created with a description and the description can be changed or cleared', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const member = await new MemberFactory({ organization }).create();

            const putBody = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            putBody.addPut(BalanceItemWithPayments.create({
                name: 'Kampgeld',
                description: 'Weekend aan zee',
                unitPrice: 25_00,
                amount: 1,
                memberId: member.id,
            }));

            const created = (await patchBalanceItems({ body: putBody, organization, user: admin })).body[0];
            expect(created.name).toBe('Kampgeld');
            expect(created.description).toBe('Weekend aan zee');

            const patchBody = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            patchBody.addPatch(BalanceItemWithPayments.patch({ id: created.id, description: 'Weekend in de Ardennen' }));
            const patched = (await patchBalanceItems({ body: patchBody, organization, user: admin })).body[0];
            expect(patched.name).toBe('Kampgeld');
            expect(patched.description).toBe('Weekend in de Ardennen');

            const clearBody = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            clearBody.addPatch(BalanceItemWithPayments.patch({ id: created.id, description: null }));
            const cleared = (await patchBalanceItems({ body: clearBody, organization, user: admin })).body[0];
            expect(cleared.description).toBeNull();

            const model = await BalanceItem.getByID(created.id);
            expect(model?.name).toBe('Kampgeld');
            expect(model?.description).toBeNull();
        });

        test('a patch without description keeps the existing description', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const member = await new MemberFactory({ organization }).create();
            const balanceItem = await new BalanceItemFactory({ organizationId: organization.id, memberId: member.id, name: 'Kampgeld', description: 'Weekend aan zee', amount: 1, unitPrice: 25_00 }).create();

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPatch(BalanceItemWithPayments.patch({ id: balanceItem.id, name: 'Weekendgeld' }));
            const patched = (await patchBalanceItems({ body, organization, user: admin })).body[0];

            expect(patched.name).toBe('Weekendgeld');
            expect(patched.description).toBe('Weekend aan zee');
        });
    });

    describe('Financial access rights', () => {
        /**
         * Creates a balance item for a registration, together with a user that can only write the
         * group of that registration, and that only carries the passed access rights.
         */
        async function setupRegistrationBalanceItem(accessRights: AccessRight[]) {
            TestUtils.setEnvironment('userMode', 'platform');

            const period = await new RegistrationPeriodFactory({
                startDate: new Date(2023, 0, 1),
                endDate: new Date(2023, 11, 31),
            }).create();

            const role = PermissionRoleDetailed.create({
                name: 'Test Role',
                accessRights,
            });

            const organization = await new OrganizationFactory({ period, roles: [role] }).create();
            const group = await new GroupFactory({ organization, period }).create();

            const user = await new UserFactory({
                organization,
                permissions: Permissions.create({
                    level: PermissionLevel.None,
                    roles: [role],
                    resources: new Map([[
                        PermissionsResourceType.Groups, new Map([[
                            group.id,
                            ResourcePermissions.create({
                                level: PermissionLevel.Write,
                                accessRights,
                            }),
                        ]]),
                    ]]),
                }),
            }).create();

            const member = await new MemberFactory({ organization }).create();
            const registration = await new RegistrationFactory({ member, group }).create();

            const balanceItem = await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                registrationId: registration.id,
                type: BalanceItemType.Registration,
                name: 'Lidgeld',
                amount: 1,
                unitPrice: 25_00,
            }).create();

            return { organization, user, balanceItem };
        }

        test('a user without MemberWriteFinancialData cannot change the price of a balance item of a registration they can write', async () => {
            const { organization, user, balanceItem } = await setupRegistrationBalanceItem([]);

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPatch(BalanceItemWithPayments.patch({ id: balanceItem.id, unitPrice: 500_00 }));

            // Write access to the group of a registration is not write access to what it costs
            await expect(patchBalanceItems({ body, organization, user })).rejects.toThrow(
                STExpect.errorWithCode('permission_denied'),
            );

            const model = await BalanceItem.getByID(balanceItem.id);
            expect(model?.unitPrice).toBe(25_00);
        });

        test('a user with MemberWriteFinancialData can change the price of a balance item of a registration they can write', async () => {
            const { organization, user, balanceItem } = await setupRegistrationBalanceItem([AccessRight.MemberWriteFinancialData]);

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPatch(BalanceItemWithPayments.patch({ id: balanceItem.id, unitPrice: 500_00 }));

            const patched = (await patchBalanceItems({ body, organization, user })).body[0];
            expect(patched.unitPrice).toBe(500_00);
        });
    });

    describe('Audit logs', () => {
        test('creating a balance item is logged with the member as payer', async () => {
            const organization = await new OrganizationFactory({}).create();
            const admin = await new UserFactory({ organization, permissions: Permissions.create({ level: PermissionLevel.Full }) }).create();
            const member = await new MemberFactory({ organization }).create();

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPut(BalanceItemWithPayments.create({
                name: 'Kampgeld',
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
                name: 'Kampgeld',
                unitPrice: 25_00,
                amount: 1,
                createdAt: new Date(Date.now() - 60_000),
            }).create();

            const body = new PatchableArray<string, BalanceItemWithPayments, AutoEncoderPatchType<BalanceItemWithPayments>>();
            body.addPatch(BalanceItemWithPayments.patch({
                id: balanceItem.id,
                name: 'Weekendgeld',
                unitPrice: 30_00,
                status: BalanceItemStatus.Canceled,
            }));

            await patchBalanceItems({ body, organization, user: admin });

            const logs = await AuditLog.select().where('type', AuditLogType.BalanceItemEdited).where('objectId', balanceItem.id).fetch();
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.replacements.get('b')).toMatchObject({ id: balanceItem.id, value: 'Weekendgeld', type: AuditLogReplacementType.BalanceItem });

            const keys = log.patchList.map(p => p.key.toKey());
            expect(keys).toEqual(expect.arrayContaining(['name', 'unitPrice', 'status']));
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
                name: 'Lidgeld',
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
