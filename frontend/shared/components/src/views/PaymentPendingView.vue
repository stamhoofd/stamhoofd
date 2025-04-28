<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`be295439-991b-4ba6-b9d5-b4e8ae6a198d`)" />

        <main v-if="payment && payment.status === 'Pending' && payment.method === 'DirectDebit'">
            <h1>{{ $t('e8247764-d10a-4c54-97e2-acca397b8ac9') }}</h1>
            <p>{{ $t("2929f382-929d-42c8-9091-e3496d35e184") }}</p>
        </main>

        <main v-else-if="!payment || payment.status !== 'Failed'">
            <h1>{{ $t('3db0fd13-4501-432a-ada6-7f48efea9fe3') }}</h1>
            <p>{{ $t('3c984618-93b7-491a-8324-70c61d128114') }}</p>

            <Spinner />
        </main>

        <main v-else>
            <h1>{{ $t('5690126d-651e-475d-9503-cfe6825a9735') }}</h1>
            <p>{{ $t('a839ffe6-e8e0-4699-91c3-64092087b380') }}</p>
        </main>

        <STToolbar v-if="payment && (payment.status === 'Failed' || payment.method === 'Payconiq')">
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="retry">
                        <span>{{ $t('bccb094f-12eb-40d0-9a24-843832b0cdb7') }}</span>
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
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

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
const payment = shallowRef<PaymentGeneral | null>(null);
const loading = ref(false);

let pollCount = 0;
let timeout: NodeJS.Timeout | null = null;
let didFinish = false;

onMounted(() => {
    timeout = setTimeout(() => poll(), 200);
});

function retry() {
    if (confirm($t(`2166f942-4fce-476f-adf2-d5803ff4ed16`))) {
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
