import { ArrayDecoder, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, GlobalEventBus, Toast, useContext } from '@stamhoofd/components';
import { SessionContext } from '@stamhoofd/networking';
import { Payment, PaymentGeneral, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';

export function useMarkPaymentsPaid() {
    const context = useContext();

    return (payments: PaymentGeneral[], paid = true) => {
        return markPaymentsPaid(context.value, payments, paid);
    };
}

async function markPaymentsPaid(context: SessionContext, payments: PaymentGeneral[], paid = true) {
    const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray();
    let hasOrder = false;
    for (const payment of payments) {
        if (payment.webshopIds.length > 0) {
            hasOrder = true;
        }

        if (![PaymentMethod.Unknown, PaymentMethod.Transfer, PaymentMethod.PointOfSale].includes(payment.method)) {
            new Toast($t(`2dff49a1-ae28-487c-9664-284ea32d5363`), 'error red').setHide(4000).show();
            return;
        }

        if (paid) {
            if (payment.status !== PaymentStatus.Succeeded) {
                data.addPatch(Payment.patch({
                    id: payment.id,
                    status: PaymentStatus.Succeeded,
                }));
            }
        }
        else {
            if (payment.status == PaymentStatus.Succeeded) {
                data.addPatch(Payment.patch({
                    id: payment.id,
                    status: PaymentStatus.Created,
                }));
            }
        }
    }

    if (data.changes.length > 0) {
        if (!await CenteredMessage.confirm($t(`c8217f03-4005-47e7-b032-69f59dd05499`), paid ? $t(`aca879f0-55d3-4964-a8ad-0eedf18228fb`) : $t(`b3d75fdd-8231-4a1f-a1b3-5c6401d90a75`), paid && hasOrder ? $t(`0a79a933-90a4-477e-9598-b64d6bb28281`) : undefined)) {
            return;
        }

        try {
            const response = await context.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/payments',
                body: data,
                decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                shouldRetry: false,
            });

            deepSetArray(payments, response.data);

            new Toast($t(`8076e99d-cac2-4fb6-84e0-d893d9b3c205`), 'success').setHide(3000).show();

            for (const payment of response.data) {
                GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }
    else {
        new Toast(paid ? $t(`37848bd6-919a-4f31-bfc7-e0e809e68847`) : payments.length === 1 ? $t(`d9e58e49-d5d5-4a89-9e6a-1bd8eaf0cb1e`) : $t(`d23f91da-079b-40fe-9da1-14b9ac7e65ab`), 'error red').show();
    }
}
