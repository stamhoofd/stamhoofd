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
            new Toast('Je kan de betaalstatus van online betalingen niet wijzigen', 'error red').setHide(4000).show();
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
        if (!await CenteredMessage.confirm('Ben je zeker?', paid ? 'Markeer als betaald' : 'Markeer als niet betaald', paid && hasOrder ? 'De besteller(s) van bestellingen ontvangen in sommige gevallen een automatische e-mail.' : undefined)) {
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

            new Toast('Betaalstatus gewijzigd', 'success').setHide(3000).show();

            for (const payment of response.data) {
                GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }
    else {
        new Toast(paid ? 'Al gemarkeerd als betaald' : ('Deze ' + (payments.length == 1 ? 'betaling werd' : 'betalingen werden') + ' nog niet betaald'), 'error red').setHide(2000).show();
    }
}
