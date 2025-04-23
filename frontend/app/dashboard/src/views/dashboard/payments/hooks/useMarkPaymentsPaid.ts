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
            new Toast($t(`Je kan de betaalstatus van online betalingen niet wijzigen`), 'error red').setHide(4000).show();
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
        if (!await CenteredMessage.confirm($t(`Ben je zeker?`), paid ? $t(`Markeer als betaald`) : $t(`Markeer als niet betaald`), paid && hasOrder ? $t(`De besteller(s) van bestellingen ontvangen in sommige gevallen een automatische e-mail.`) : undefined)) {
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

            new Toast($t(`Betaalstatus gewijzigd`), 'success').setHide(3000).show();

            for (const payment of response.data) {
                GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }
    else {
        new Toast(paid ? $t(`Al gemarkeerd als betaald`) : payments.length === 1 ? $t(`Deze betaling werd nog niet betaald`) : $t(`Deze betalingen werden nog niet betaald`), 'error red').setHide(2000).show();
    }
}
