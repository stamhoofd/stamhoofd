import { Request } from '@simonbackx/simple-endpoints';
import type { User } from '@stamhoofd/models';
import { BalanceItemFactory, Invoice, Organization, OrganizationFactory, Payment, Platform, UserFactory } from '@stamhoofd/models';
import { ApplicationFee } from '@stamhoofd/models/models/ApplicationFee.js';
import { SettlementCharge } from '@stamhoofd/models/models/SettlementCharge.js';
import { PatchableArray } from '@simonbackx/simple-encoding';
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { AccessRight, Address, Organization as OrganizationStruct, OrganizationMetaData, OrganizationPrivateMetaData, OrganizationTag, PaymentMethod, PaymentStatus, PermissionLevel, Permissions, PermissionsResourceKey, PermissionsResourceType, ResourcePermissions } from '@stamhoofd/structures';
import { ApplicationFeeType } from '@stamhoofd/structures/settlements/ApplicationFeeType.js';
import { SettlementChargeType } from '@stamhoofd/structures/settlements/SettlementChargeType.js';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { initPlatformAdmin } from '../../../../tests/init/index.js';
import { initMembershipOrganization } from '../../../../tests/init/initMembershipOrganization.js';
import { SessionService } from '../../../services/SessionService.js';
import { PatchOrganizationsEndpoint } from './PatchOrganizationsEndpoint.js';

const baseUrl = `/admin/organizations`;
const endpoint = new PatchOrganizationsEndpoint();

describe('Endpoint.PatchOrganizationsEndpoint', () => {
    let membershipOrganization: Organization;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
    });

    beforeAll(async () => {
        membershipOrganization = await initMembershipOrganization();
    });

    const deleteOrganization = async (organization: Organization) => {
        const { adminToken } = await initPlatformAdmin();

        const patch: PatchableArrayAutoEncoder<OrganizationStruct> = new PatchableArray();
        patch.addDelete(organization.id);

        // Platform admins are not scoped to an organization, so no host is required
        const request = Request.patch({
            path: baseUrl,
            host: '',
            body: patch,
            headers: {
                authorization: 'Bearer ' + adminToken.accessToken,
            },
        });

        return await testServer.test(endpoint, request);
    };

    const createPayment = async ({ payingOrganizationId }: { payingOrganizationId: string | null }) => {
        const payment = new Payment();
        payment.organizationId = membershipOrganization.id;
        payment.payingOrganizationId = payingOrganizationId;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 10_00;
        await payment.save();
        return payment;
    };

    const createApplicationFee = async ({ payingOrganizationId }: { payingOrganizationId: string }) => {
        const charge = new SettlementCharge();
        charge.type = SettlementChargeType.ApplicationFeeService;
        charge.externalId = uuidv4();
        charge.amount = -30_00;
        charge.organizationId = payingOrganizationId;
        charge.occurredAt = new Date();
        await charge.save();

        const fee = new ApplicationFee();
        fee.externalId = uuidv4();
        fee.type = ApplicationFeeType.Service;
        fee.amount = 30_00;
        fee.organizationId = membershipOrganization.id;
        fee.payingOrganizationId = payingOrganizationId;
        fee.settlementChargeId = charge.id;
        fee.occurredAt = new Date();
        await fee.save();
        return fee;
    };

    const createInvoice = async ({ payingOrganizationId }: { payingOrganizationId: string | null }) => {
        const invoice = new Invoice();
        invoice.organizationId = membershipOrganization.id;
        invoice.payingOrganizationId = payingOrganizationId;
        await invoice.save();
        return invoice;
    };

    test('An organization without financial records can be deleted', async () => {
        const organization = await new OrganizationFactory({}).create();

        const response = await deleteOrganization(organization);

        expect(response.status).toBe(200);
        expect(await Organization.getByID(organization.id)).toBeUndefined();
    });

    const payerRecords = [
        {
            name: 'a balance item it owes',
            create: async (organization: Organization) => {
                await new BalanceItemFactory({
                    organizationId: membershipOrganization.id,
                    payingOrganizationId: organization.id,
                    amount: 1,
                    unitPrice: 10_00,
                }).create();
            },
        },
        {
            name: 'a payment it made',
            create: async (organization: Organization) => {
                await createPayment({ payingOrganizationId: organization.id });
            },
        },
        {
            name: 'an application fee it was charged',
            create: async (organization: Organization) => {
                await createApplicationFee({ payingOrganizationId: organization.id });
            },
        },
        {
            name: 'an invoice it has to pay',
            create: async (organization: Organization) => {
                await createInvoice({ payingOrganizationId: organization.id });
            },
        },
    ];

    test.each(payerRecords)('An organization with $name cannot be deleted', async ({ create }) => {
        const organization = await new OrganizationFactory({}).create();
        await create(organization);

        await expect(deleteOrganization(organization)).rejects.toThrow(STExpect.errorWithCode('organization_has_financial_records'));
        expect(await Organization.getByID(organization.id)).toBeDefined();
    });

    test('Financial records the organization received do not block the delete', async () => {
        const organization = await new OrganizationFactory({}).create();

        await new BalanceItemFactory({
            organizationId: organization.id,
            amount: 1,
            unitPrice: 10_00,
        }).create();

        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.price = 10_00;
        await payment.save();

        const invoice = new Invoice();
        invoice.organizationId = organization.id;
        await invoice.save();

        const response = await deleteOrganization(organization);

        expect(response.status).toBe(200);
        expect(await Organization.getByID(organization.id)).toBeUndefined();
    });

    describe('Creating organizations', () => {
        const provinceTag = OrganizationTag.create({ name: 'Province' });
        const managedTag = OrganizationTag.create({ name: 'Managed region' });
        const managedChildTag = OrganizationTag.create({ name: 'Managed town' });
        const otherTag = OrganizationTag.create({ name: 'Other region' });
        const unrelatedTag = OrganizationTag.create({ name: 'Unrelated' });
        provinceTag.childTags = [managedTag.id, otherTag.id];
        managedTag.childTags = [managedChildTag.id];

        let originalTags: OrganizationTag[];

        const setPlatformTags = async (tags: OrganizationTag[]) => {
            const platform = await Platform.getForEditing();
            platform.config.tags = tags;
            await platform.save();
        };

        beforeEach(async () => {
            TestUtils.setEnvironment('userMode', 'platform');
        });

        beforeAll(async () => {
            originalTags = (await Platform.getForEditing()).config.tags;
            await setPlatformTags([provinceTag, managedTag, managedChildTag, otherTag, unrelatedTag]);
        });

        afterAll(async () => {
            await setPlatformTags(originalTags);
        });

        const createAdmin = async ({ accessRights, tagId = managedTag.id, level = PermissionLevel.Write }: { accessRights: AccessRight[]; tagId?: string; level?: PermissionLevel }) => {
            return await new UserFactory({
                globalPermissions: Permissions.create({
                    resources: new Map([
                        [PermissionsResourceType.OrganizationTags, new Map([
                            [tagId, ResourcePermissions.create({ level, accessRights })],
                        ])],
                    ]),
                }),
            }).create();
        };

        const sendPatch = async (user: User, patch: PatchableArrayAutoEncoder<OrganizationStruct>) => {
            const token = await SessionService.createSession(user);
            const request = Request.patch({
                path: baseUrl,
                host: '',
                body: patch,
                headers: {
                    authorization: 'Bearer ' + token.accessToken,
                },
            });
            return await testServer.test(endpoint, request);
        };

        const createOrganization = async (user: User, tags: string[], options?: { uri?: string }) => {
            const name = 'New organization ' + uuidv4();
            const organization = OrganizationStruct.create({
                name,
                uri: options?.uri ?? Formatter.slug(name),
                address: Address.createDefault(),
                meta: OrganizationMetaData.create({ tags, enableBetaFeatures: true }),
                privateMeta: OrganizationPrivateMetaData.create({ featureFlags: ['test-flag'] }),
            });
            const patch: PatchableArrayAutoEncoder<OrganizationStruct> = new PatchableArray();
            patch.addPut(organization);

            const response = await sendPatch(user, patch);
            expect(response.body).toHaveLength(1);
            return (await Organization.getByID(response.body[0].id))!;
        };

        test('An admin with the create right for a tag can create an organization with that tag', async () => {
            const admin = await createAdmin({ accessRights: [AccessRight.PlatformCreateOrganizations] });
            const organization = await createOrganization(admin, [managedTag.id]);

            expect(organization.meta.tags).toEqual([provinceTag.id, managedTag.id]);

            // Only platform admins with full access can configure other settings
            expect(organization.meta.enableBetaFeatures).toBe(false);
            expect(organization.privateMeta.featureFlags).toEqual([]);

            const platform = await Platform.getShared();
            expect(platform.config.tags.find(t => t.id === managedTag.id)?.organizationCount).toBeGreaterThan(0);
        });

        test('The uri is slugified and the id is chosen by the server for admins without full access', async () => {
            const admin = await createAdmin({ accessRights: [AccessRight.PlatformCreateOrganizations] });
            const existing = await new OrganizationFactory({}).create();
            const uri = 'My Custom URI ' + uuidv4();

            const name = 'New organization ' + uuidv4();
            const put = OrganizationStruct.create({
                id: existing.id,
                name,
                uri,
                address: Address.createDefault(),
                meta: OrganizationMetaData.create({ tags: [managedTag.id] }),
            });
            const patch: PatchableArrayAutoEncoder<OrganizationStruct> = new PatchableArray();
            patch.addPut(put);

            const response = await sendPatch(admin, patch);
            const organization = (await Organization.getByID(response.body[0].id))!;

            expect(organization.id).not.toBe(existing.id);
            expect(organization.uri).toBe(Formatter.slug(uri));
        });

        test('A uri that is too short is rejected', async () => {
            const admin = await createAdmin({ accessRights: [AccessRight.PlatformCreateOrganizations] });
            await expect(createOrganization(admin, [managedTag.id], { uri: '#!' })).rejects.toThrow(STExpect.errorWithCode('invalid_field'));
        });

        test('An admin with the create right for a tag can create an organization with a child tag', async () => {
            const admin = await createAdmin({ accessRights: [AccessRight.PlatformCreateOrganizations] });
            const organization = await createOrganization(admin, [managedChildTag.id]);

            expect(organization.meta.tags).toEqual([provinceTag.id, managedTag.id, managedChildTag.id]);
        });

        test('An admin with the create right for all organizations can create an organization without tags', async () => {
            const admin = await createAdmin({ accessRights: [AccessRight.PlatformCreateOrganizations], tagId: PermissionsResourceKey.All });
            const organization = await createOrganization(admin, []);

            expect(organization.meta.tags).toEqual([]);
        });

        test('A full platform admin can configure all settings', async () => {
            const { admin } = await initPlatformAdmin();
            const organization = await createOrganization(admin, [otherTag.id]);

            expect(organization.meta.enableBetaFeatures).toBe(true);
            expect(organization.privateMeta.featureFlags).toEqual(['test-flag']);
        });

        test.each([
            { name: 'without the create right', accessRights: [AccessRight.EventWrite], tags: [managedTag.id] },
            { name: 'with full access to their tag but without the create right', accessRights: [], level: PermissionLevel.Full, tags: [managedTag.id] },
            { name: 'with only a parent of their tag', accessRights: [AccessRight.PlatformCreateOrganizations], tags: [provinceTag.id] },
            { name: 'with a tag they do not manage', accessRights: [AccessRight.PlatformCreateOrganizations], tags: [otherTag.id] },
            { name: 'with a tag they do not manage next to their own tag', accessRights: [AccessRight.PlatformCreateOrganizations], tags: [managedTag.id, unrelatedTag.id] },
            { name: 'without tags', accessRights: [AccessRight.PlatformCreateOrganizations], tags: [] },
        ])('An admin $name cannot create an organization', async ({ accessRights, level, tags }) => {
            const admin = await createAdmin({ accessRights, level });
            await expect(createOrganization(admin, tags)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        });

        test('An admin without the create right cannot create organizations on a platform without tags', async () => {
            await setPlatformTags([]);
            try {
                const admin = await createAdmin({ accessRights: [AccessRight.EventWrite], tagId: PermissionsResourceKey.All });
                await expect(createOrganization(admin, [])).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            }
            finally {
                await setPlatformTags([provinceTag, managedTag, managedChildTag, otherTag, unrelatedTag]);
            }
        });

        test('An admin with the create right cannot delete organizations', async () => {
            const admin = await createAdmin({ accessRights: [AccessRight.PlatformCreateOrganizations] });
            const organization = await new OrganizationFactory({ tags: [managedTag.id] }).create();

            const patch: PatchableArrayAutoEncoder<OrganizationStruct> = new PatchableArray();
            patch.addDelete(organization.id);

            await expect(sendPatch(admin, patch)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
            expect(await Organization.getByID(organization.id)).toBeDefined();
        });
    });
});
