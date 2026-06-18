import type { Decoder } from '@simonbackx/simple-encoding';
import type { Server } from '@simonbackx/simple-networking';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { Payment, PaymentStatus } from '@stamhoofd/structures';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import { CenteredMessage } from '../overlays/CenteredMessage';
import { usePreventLeave } from '#hooks/usePreventLeave.ts';

export interface PayconiqPaymentProps {
    paymentUrl: string;
    initialPayment: Payment;
    server: Server;
    finishedHandler: (payment: Payment | null) => void;
}

export function usePayconiqPayment(props: PayconiqPaymentProps) {
    const dismiss = useDismiss();
    const payment = shallowRef(props.initialPayment);
    const pollCount = ref(0);
    const canceling = ref(false);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const price = computed(() => payment.value.price ?? 0);
    const qrCodeSrc = computed(() => props.paymentUrl);

    async function close() {
        await dismiss();
    }

    function cancel() {
        if (canceling.value) {
            return;
        }
        canceling.value = true;
        props.server.request({
            method: 'POST',
            path: '/payments/' + payment.value.id,
            query: {
                cancel: true,
            },
            decoder: Payment as Decoder<Payment>,
        }).catch(console.error);
    }

    usePreventLeave(() => {
        // This message is not visible on most browsers
        return $t(`%12e`);
    });

    async function shouldNavigateAway() {
        if (await CenteredMessage.confirm($t(`%12e`), $t(`%12f`))) {
            cancel();
            return true;
        }
        return false;
    }

    function poll() {
        timer = null;
        props.server.request({
            method: 'POST',
            path: '/payments/' + payment.value.id,
            decoder: Payment as Decoder<Payment>,
        }).then((response) => {
            payment.value = response.data;

            if (payment.value.status === PaymentStatus.Succeeded || payment.value.status === PaymentStatus.Failed) {
                props.finishedHandler(payment.value);
                dismiss({ force: true }).catch(console.error);
            }
        }).catch(console.error).finally(() => {
            pollCount.value++;
            if (payment.value.status === PaymentStatus.Succeeded || payment.value.status === PaymentStatus.Failed) {
                return;
            }
            timer = setTimeout(poll, 3000);
        });
    }

    onMounted(() => {
        timer = setTimeout(poll, 3000);
    });

    onBeforeUnmount(() => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        if (payment.value.status !== PaymentStatus.Succeeded && payment.value.status !== PaymentStatus.Failed) {
            props.finishedHandler(payment.value);
        }
    });

    return {
        close,
        payment,
        price,
        qrCodeSrc,
        shouldNavigateAway,
    };
}
