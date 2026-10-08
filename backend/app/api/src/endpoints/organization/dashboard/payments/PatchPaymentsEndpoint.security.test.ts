import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-endpoints';
import type { BalanceItem, Organization, User } from '@stamhoofd/models';
import { BalanceItemFactory, BalanceItemPayment, GroupFactory, MemberFactory, OrganizationFactory, Payment, RegistrationFactory, UserFactory } from '@stamhoofd/models';
import { AccessRight, BalanceItemDetailed, BalanceItemPaymentDetailed, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PermissionLevel, Permissions, PermissionsResourceType, ResourcePermissions, Version } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';

import { testServer } from '../../../../../tests/helpers/TestServer.js';
import { initAdmin } from '../../../../../tests/init/index.js';
import { SessionService } from '../../../../services/SessionService.js';
import { PatchPaymentsEndpoint } from './PatchPaymentsEndpoint.js';

/**
 * An admin who manages one group may only register, change or refund payments for balance
 * items of that group: one accessible item in a payment does not authorize the other items.
 */
describe('Security.PatchPayments', () => {
    const endpoint = new PatchPaymentsEndpoint();
    const price = 10_0000;

    async function setup() {
        const organization = await new OrganizationFactory({}).create();
        const managedGroup = await new GroupFactory({ organization }).create();
        const otherGroup = await new GroupFactory({ organization }).create();

        const resources = new Map();
        resources.set(PermissionsResourceType.Groups, new Map([[managedGroup.id, ResourcePermissions.create({ level: PermissionLevel.Write })]]));
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.None, resources }),
        }).create();

        const createItem = async (group: typeof managedGroup) => {
            const member = await new MemberFactory({ organization }).create();
            const registration = await new RegistrationFactory({ member, group }).create();
            return await new BalanceItemFactory({
                organizationId: organization.id,
                memberId: member.id,
                registrationId: registration.id,
                amount: 1,
                unitPrice: price,
            }).create();
        };

        return {
            organization,
            admin,
            managedItem: await createItem(managedGroup),
            otherItem: await createItem(otherGroup),
        };
    }

    async function send(organization: Organization, admin: User, body: PatchableArrayAutoEncoder<PaymentGeneral>) {
        const token = await SessionService.createSession(admin);
        const request = Request.buildJson('PATCH', `/v${Version}/organization/payments`, organization.getApiHost(), body);
        request.headers.authorization = 'Bearer ' + token.accessToken;
        return await testServer.test(endpoint, request);
    }

    function manualPayment(items: BalanceItem[]) {
        return PaymentGeneral.create({
            type: PaymentType.Payment,
            method: PaymentMethod.PointOfSale,
            status: PaymentStatus.Succeeded,
            balanceItemPayments: items.map(balanceItem => BalanceItemPaymentDetailed.create({
                balanceItem: BalanceItemDetailed.create({ ...balanceItem }),
                price,
            })),
        });
    }

    async function createPendingPayment(organization: Organization, items: BalanceItem[]) {
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Pending;
        payment.type = PaymentType.Payment;
        payment.price = price * items.length;
        await payment.save();

        for (const balanceItem of items) {
            const balanceItemPayment = new BalanceItemPayment();
            balanceItemPayment.balanceItemId = balanceItem.id;
            balanceItemPayment.paymentId = payment.id;
            balanceItemPayment.organizationId = organization.id;
            balanceItemPayment.price = price;
            await balanceItemPayment.save();
        }

        return payment;
    }

    test('a group admin cannot register a manual payment that also covers a balance item of another group', async () => {
        const { organization, admin, managedItem, otherItem } = await setup();

        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        arr.addPut(manualPayment([managedItem, otherItem]));

        await expect(send(organization, admin, arr)).rejects.toThrow(STExpect.errorWithCode('permission_denied'));
        expect(await Payment.where({ organizationId: organization.id })).toHaveLength(0);
    });

    test('a group admin can register a manual payment for balance items of their group', async () => {
        const { organization, admin, managedItem } = await setup();

        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        arr.addPut(manualPayment([managedItem]));

        const response = await send(organization, admin, arr);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].status).toBe(PaymentStatus.Succeeded);
    });

    test('an admin who manages payments can register a manual payment covering both groups', async () => {
        const { organization, managedItem, otherItem } = await setup();
        const { admin } = await initAdmin({ organization, accessRights: [AccessRight.OrganizationManagePayments] });

        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        arr.addPut(manualPayment([managedItem, otherItem]));

        const response = await send(organization, admin, arr);
        expect(response.body[0].status).toBe(PaymentStatus.Succeeded);
    });

    test('a group admin cannot mark a payment as paid that also covers a balance item of another group', async () => {
        const { organization, admin, managedItem, otherItem } = await setup();
        const payment = await createPendingPayment(organization, [managedItem, otherItem]);

        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        arr.addPatch(PaymentGeneral.patch({ id: payment.id, status: PaymentStatus.Succeeded }));

        await expect(send(organization, admin, arr)).rejects.toThrow(STExpect.errorWithCode('not_found'));
        expect((await Payment.getByID(payment.id))!.status).toBe(PaymentStatus.Pending);
    });

    test('a group admin can mark a payment as paid that only covers balance items of their group', async () => {
        const { organization, admin, managedItem } = await setup();
        const payment = await createPendingPayment(organization, [managedItem]);

        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        arr.addPatch(PaymentGeneral.patch({ id: payment.id, status: PaymentStatus.Succeeded }));

        const response = await send(organization, admin, arr);
        expect(response.body[0].status).toBe(PaymentStatus.Succeeded);
        expect((await Payment.getByID(payment.id))!.status).toBe(PaymentStatus.Succeeded);
    });
});
