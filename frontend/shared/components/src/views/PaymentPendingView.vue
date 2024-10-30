<template>
    <div class="st-view">
        <STNavigationBar title="Betaling" />

        <main v-if="payment && payment.status === 'Pending' && payment.method === 'DirectDebit'">
            <h1>Betaling in verwerking</h1>
            <p>Jouw betaling is aangevraagd via jouw bank. Het kan tot 5 werkdagen duren voor we een bevestiging van de betaling ontvangen. In tussentijd blijft de betaling de status 'in verwerking' behouden.</p>
        </main>

        <main v-else-if="!payment || payment.status !== 'Failed'">
            <h1>Wachten op betaalbevestiging...</h1>
            <p>We wachten op de betaalbevestiging van de bank. Verlaat deze pagina niet. Dit duurt hooguit 5 minuten.</p>

            <Spinner />
        </main>

        <main v-else>
            <h1>Betaling mislukt</h1>
            <p>De betaling werd geannuleerd of door de bank geweigerd.</p>
        </main>

        <STToolbar v-if="payment && (payment.status === 'Failed' || payment.method === 'Payconiq')">
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="retry">
                        <span>Opnieuw proberen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { Server } from '@simonbackx/simple-networking';
import { useNavigationController, usePopup } from '@simonbackx/vue-app-navigation';
import { LoadingButton, NavigationActions, Spinner, STNavigationBar, STToolbar, useNavigationActions } from '@stamhoofd/components';
import { PaymentGeneral, PaymentStatus } from '@stamhoofd/structures';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{
    paymentId: string;
    // Try to cancel the payment if still possible
    cancel?: boolean;
    server: Server;
    finishedHandler: (navigationActions: NavigationActions & { popup: ReturnType<typeof usePopup> }, payment: PaymentGeneral | null) => void;
    errorHandler?: null | ((navigationActions: NavigationActions, error: unknown) => Promise<void> | void);
}>(), {
    cancel: false,
    errorHandler: null,
});

const navigationActions = useNavigationActions();
const popup = usePopup();
const navigationController = useNavigationController();
const payment = ref<PaymentGeneral | null>(null);
const loading = ref(false);

let pollCount = 0;
let timeout: NodeJS.Timeout | null = null;
let didFinish = false;

onMounted(() => {
    timeout = setTimeout(() => poll(), 200);
});

function retry() {
    if (confirm('Probeer alleen opnieuw als je zeker bent dat je niet hebt betaald! Anders moet je gewoon even wachten.')) {
        if (navigationController.value!.components.length > 1) {
            navigationActions.pop()?.catch(console.error);
        }
        else {
            props.finishedHandler({ ...navigationActions, popup }, payment.value);
        }
    }
}

function poll() {
    timeout = null;

    if (didFinish) {
        return;
    }
    const paymentId = props.paymentId;
    props.server
        .request({
            method: 'POST',
            path: '/payments/' + paymentId,
            decoder: PaymentGeneral as Decoder<PaymentGeneral>,
            query: {
                cancel: props.cancel,
            },
        }).then((response) => {
            const paymentFromResponse = response.data;
            payment.value = paymentFromResponse;

            pollCount++;

            if (didFinish) {
                return;
            }
            if (payment.value && (payment.value.status === PaymentStatus.Succeeded || payment.value.status === PaymentStatus.Failed)) {
                didFinish = true;
                props.finishedHandler({ ...navigationActions, popup }, payment.value);
                return;
            }
            timeout = setTimeout(() => poll(), 3000 + Math.min(10 * 1000, pollCount * 1000));
        }).catch((e) => {
            if (didFinish) {
                return;
            }
            didFinish = true;
            if (props.errorHandler) {
                props.errorHandler(navigationActions, e)?.catch(console.error);
            }
            else {
                props.finishedHandler({ ...navigationActions, popup }, payment.value);
            }
        });
}

onBeforeUnmount(() => {
    if (timeout) {
        clearTimeout(timeout);
        timeout = null;
    }
});
</script>
