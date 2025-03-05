<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`1cd57a56-7d3c-4435-ba60-1688b3bfa2e5`)"/>

        <main v-if="payment && payment.status === 'Pending' && payment.method === 'DirectDebit'">
            <h1>{{ $t('e7772c32-4512-4b9a-bcc1-624d7f6e6259') }}</h1>
            <p>{{ $t("96dffb93-3dc1-468c-bfe7-41273749a4ac") }}</p>
        </main>

        <main v-else-if="!payment || payment.status !== 'Failed'">
            <h1>{{ $t('f2729f97-b278-415b-8d11-ea8b8e93f143') }}</h1>
            <p>{{ $t('cec4261e-53e9-485d-bf86-249fcc901677') }}</p>

            <Spinner/>
        </main>

        <main v-else>
            <h1>{{ $t('2a2dac34-253a-457f-b12f-5b8d955a761d') }}</h1>
            <p>{{ $t('714c5044-e5a1-451c-97ed-c905852b0a1e') }}</p>
        </main>

        <STToolbar v-if="payment && (payment.status === 'Failed' || payment.method === 'Payconiq')">
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="retry">
                        <span>{{ $t('bb3e7bd9-eead-4baa-a445-78f35b0d7c56') }}</span>
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
