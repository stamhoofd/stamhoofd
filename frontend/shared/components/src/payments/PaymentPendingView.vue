<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%kP`)" />

        <main v-if="payment && payment.status !== PaymentStatus.Succeeded && payment.status !== PaymentStatus.Failed && payment.method === PaymentMethod.DirectDebit">
            <h1>{{ $t('%kK') }}</h1>
            <p>{{ $t("%kO") }}</p>
        </main>

        <main v-else-if="!payment || PaymentStatus.Failed">
            <p class="style-title-prefix flex">
                <span>{{ $t('Even geduld...') }}</span>
                <ProgressRing :radius="7" :stroke="2" :loading="true" />
            </p>

            <h1>
                {{ $t('%kL') }}
            </h1>
            <p>{{ $t('%kM') }}</p>

            <p class="warning-box">
                {{ $t('Sluit dit scherm niet tot je betaling werd bevestigd. Het kan zijn dat de betaling nog mislukt, zo blijf je op de hoogte.') }}
            </p>
        </main>

        <main v-else>
            <h1>{{ $t('%Je') }}</h1>
            <p>{{ $t('%kN') }}</p>
        </main>

        <STToolbar v-if="payment && (payment.status === 'Failed' || payment.method === 'Payconiq')">
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="retry">
                        <span>{{ $t('%1EU') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import LoadingButton from '#navigation/LoadingButton.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import STToolbar from '#navigation/STToolbar.vue';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import type { Decoder } from '@simonbackx/simple-encoding';
import type { Server } from '@simonbackx/simple-networking';
import { useNavigationController, usePopup } from '@simonbackx/vue-app-navigation';
import { PaymentGeneral, PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import ProgressRing from '../icons/ProgressRing.vue';

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
    if (confirm($t(`%12i`))) {
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
