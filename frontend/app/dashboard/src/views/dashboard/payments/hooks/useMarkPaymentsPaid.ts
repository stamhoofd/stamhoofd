import { ArrayDecoder, Decoder, deepSetArray, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { SessionContext } from '@stamhoofd/networking/SessionContext';
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
            new Toast($t(`%MX`), 'error red').setHide(4000).show();
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
        if (!await CenteredMessage.confirm($t(`%MY`), paid ? $t(`%1JQ`) : $t(`%MZ`), paid && hasOrder ? $t(`%Ma`) : undefined)) {
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

            new Toast($t(`%Mb`), 'success').setHide(3000).show();

            for (const payment of response.data) {
                GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }
    else {
        new Toast(paid ? $t(`%Mc`) : payments.length === 1 ? $t(`%Md`) : $t(`%Me`), 'error red').show();
    }
}
