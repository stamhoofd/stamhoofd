import { PatchableArray } from '@simonbackx/simple-encoding';
import { PaymentStatus, PaymentGeneral } from '@stamhoofd/structures';
import { PatchPaymentsEndpoint } from '../../src/endpoints/organization/dashboard/payments/PatchPaymentsEndpoint.js';
import { testServer } from '../helpers/TestServer.js';
import { Request } from '@simonbackx/simple-endpoints';
import { Organization } from '@stamhoofd/models';
import { initAdmin } from '../init/initAdmin.js';

export async function changePaymentStatus({ payment, organization, status }: { payment: { id: string }; organization: Organization; status: PaymentStatus }) {
    expect(payment.id).toBeString();
    const { adminToken } = await initAdmin({ organization: organization });

    const arr = new PatchableArray();
    arr.addPatch(PaymentGeneral.patch({
        id: payment.id,
        status,
    }));

    const request = Request.patch({
        path: '/organization/payments',
        host: organization.getApiHost(),
        body: arr,
        headers: {
            authorization: 'Bearer ' + adminToken.accessToken,
        },
    });

    const response = await testServer.test(new PatchPaymentsEndpoint(), request);
    expect(response.status).toBe(200);
}
export async function markPaid({ payment, organization }: { payment: { id: string }; organization: Organization }) {
    await changePaymentStatus({
        payment,
        organization,
        status: PaymentStatus.Succeeded,
    });
}

export async function markNotPaid({ payment, organization }: { payment: { id: string }; organization: Organization }) {
    await changePaymentStatus({
        payment,
        organization,
        status: PaymentStatus.Created,
    });
}
