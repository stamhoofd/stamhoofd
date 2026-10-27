<template>
    <PreviewPanel>
        <template #default="{ wide }">
            <SaveView :title="title" :loading="loading" :save-text="confirmText" :save-icon="confirmIcon" :prefer-large-button="true" :hide-toolbar="wide" data-testid="payment-step" @save="goNext">
                <h1 class="larger">
                    {{ title }}
                </h1>

                <p v-if="isTrial" class="warning-box">
                    {{ $t('%Xw') }}
                </p>

                <template v-if="checkout.totalPrice > 0">
                    <STErrorsDefault :error-box="errors.errorBox" />
                    <PaymentSelectionList v-model="selectedPaymentMethod" :payment-configuration="paymentConfiguration" :amount="checkout.totalPrice" :country="organization.address.country" :context="paymentContext" />
                </template>
                <template v-else>
                    <p>{{ freeDescription }}</p>
                    <STErrorsDefault :error-box="errors.errorBox" />
                </template>

                <PreviewOutlet />
            </SaveView>
        </template>

        <template #preview>
            <CartPreview :with-customer="true" />
        </template>

        <!-- On desktop the confirm button moves below the cart -->
        <template #actions>
            <LoadingButton :loading="loading" class="max">
                <button class="button primary full" type="button" data-testid="preview-confirm-button" @click="goNext">
                    <span class="icon" :class="confirmIcon" />
                    <span>{{ confirmText }}</span>
                </button>
            </LoadingButton>
        </template>
    </PreviewPanel>
</template>

<script lang="ts" setup>
import type { Decoder } from '@common/encoding';
import { ReactiveUrl } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import PreviewOutlet from '@stamhoofd/components/layout/PreviewOutlet.vue';
import PreviewPanel from '@stamhoofd/components/layout/PreviewPanel.vue';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { PaymentHandler } from '@stamhoofd/components/views/PaymentHandler.ts';
import PaymentSelectionList from '@stamhoofd/components/views/PaymentSelectionList.vue';
import type { Payment } from '@stamhoofd/structures';
import { OrderData, OrderResponse, PaymentMethod, PaymentMethodHelper, WebshopType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import { getOrderComponent } from '../orders/getOrderComponent';
import CartPreview from './CartPreview.vue';
import type { CartKind } from './useCartKind';
import { useCartKind } from './useCartKind';

const props = defineProps<{
    handleCheckoutError: (error: unknown, navigate: NavigationActions) => Promise<void>;
}>();

const loading = ref(false);
const errors = useErrors();
const navigationActions = useNavigationActions();
const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();

const cartKind = useCartKind();

const title = computed(() => {
    if (checkout.value.totalPrice > 0) {
        return $t('%1Dn');
    }
    const texts: Record<CartKind, string> = {
        donation: $t('Bevestig jouw bijdrage'),
        ticket: $t('Bevestig jouw ticket'),
        tickets: $t('Bevestig jouw tickets'),
        registration: $t('Bevestig jouw inschrijving'),
        registrations: $t('Bevestig jouw inschrijvingen'),
        order: $t('%1Do'),
    };
    return texts[cartKind.value];
});

const freeDescription = computed(() => {
    const texts: Record<CartKind, string> = {
        donation: $t('Jouw bijdrage is definitief zodra je bevestigt.'),
        ticket: $t('Je ontvangt jouw ticket zodra je bevestigt.'),
        tickets: $t('Je ontvangt jouw tickets zodra je bevestigt.'),
        registration: $t('Jouw inschrijving is definitief zodra je bevestigt.'),
        registrations: $t('Jouw inschrijvingen zijn definitief zodra je bevestigt.'),
        order: $t('%Xx'),
    };
    return texts[cartKind.value];
});

const selectedPaymentMethod = computed<PaymentMethod | null>({
    get: () => checkoutManager.checkout.paymentMethod,
    set: (paymentMethod: PaymentMethod | null) => {
        checkoutManager.checkout.paymentMethod = paymentMethod;
        checkoutManager.saveCheckout();
    },
});

const paymentContext = computed(() => checkout.value.paymentContext);
const checkout = computed(() => checkoutManager.checkout);
const webshop = computed(() => webshopManager.webshop);
const organization = computed(() => webshopManager.organization);
const isTrial = computed(() => organization.value.meta.packages.isWebshopsTrial);
const paymentConfiguration = computed(() => webshop.value.meta.paymentConfiguration);

// An online payment continues to the payment provider, other methods (transfer, point of sale) only confirm the order
const isOnlinePayment = computed(() => {
    const method = selectedPaymentMethod.value;
    return checkout.value.totalPrice > 0 && !!method && PaymentMethodHelper.isOnline(method);
});

const confirmText = computed(() => {
    if (isOnlinePayment.value) {
        return $t('%eX');
    }

    if (webshop.value.meta.type === WebshopType.Donations) {
        return $t('%Zkm');
    }

    if (webshop.value.meta.type === WebshopType.Registrations) {
        return $t('%ZkO');
    }

    if (webshop.value.meta.type === WebshopType.Webshop) {
        return $t('%Xv');
    }

    if (checkout.value.totalPrice > 0) {
        return $t('%Zki');
    }
    return $t('%X9');
});

const confirmIcon = computed(() => isOnlinePayment.value ? 'card' : 'success');

async function goToOrder(id: string, args: NavigationActions) {
    // Force reload webshop (stock will have changed: prevent invalidating the cart)
    // Update stock in background
    webshopManager.reload().catch((e) => {
        console.error(e);
    });

    // The steps are on the navigation controller of the webshop: go back to the shop and show the order on top.
    // Not with replace: going back would restore the steps of the placed order.
    await args.navigationController?.popToRoot({ force: true });
    const component = getOrderComponent({ orderId: id, success: true });
    component.provide.reactive_navigation_url = new ReactiveUrl({ url: 'order/' + id });
    await args.show({ components: [component] });
}

async function goNext() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        if (!checkoutManager.checkout.paymentMethod) {
            checkoutManager.checkout.paymentMethod = PaymentMethod.Unknown;
        }
        // Place order
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const data = OrderData.create(checkoutManager.checkout as any);
        // The consumer language is determined server-side from the request language when placing the order.
        const response = await webshopManager.optionalAuthenticatedServer.request({
            method: 'POST',
            path: '/webshop/' + webshop.value.id + '/order',
            body: data, // TODO: add some manual casting here
            decoder: OrderResponse as Decoder<OrderResponse>,
            shouldRetry: false,
            timeout: 30000, // Longer because some payment providers are slow in development mode
        });

        const payment = response.data.order.payment;
        if (payment) {
            PaymentHandler.handlePayment({
                server: webshopManager.server,
                organization: organization.value,
                payment,
                paymentUrl: response.data.paymentUrl,
                paymentQRCode: response.data.paymentQRCode,
                transferSettings: webshopManager.webshop.meta.paymentConfiguration.transferSettings,
                type: 'order',
                navigate: navigationActions,
            }, async (_payment: Payment, args: NavigationActions) => {
                loading.value = false;
                await goToOrder(response.data.order.id, args);
            }, () => {
                // failure
                loading.value = false;
            }).catch(console.error);
            return;
        }

        // Go to success page
        loading.value = false;
        await goToOrder(response.data.order.id, navigationActions);
    } catch (e) {
        await props.handleCheckoutError(e, navigationActions);
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
