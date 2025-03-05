<template>
    <SaveView :title="title" :loading="loading" save-text="Bestelling bevestigen" :prefer-large-button="true" @save="goNext">
        <template v-if="checkout.totalPrice > 0" #left>
            <span>{{ $t('6cbde4da-3770-4726-8ea4-9a53b785a66e') }} {{ formatPrice(checkout.totalPrice) }}</span>
        </template>

        <h1>{{ title }}</h1>

        <p v-if="isTrial" class="warning-box">
            {{ $t('4411c14c-b7d3-4798-ae80-576dd4df288b') }}
        </p>

        <template v-if="checkout.totalPrice > 0">
            <STErrorsDefault :error-box="errors.errorBox"/>
            <PaymentSelectionList v-model="selectedPaymentMethod" :payment-configuration="paymentConfiguration" :amount="checkout.totalPrice" :organization="organization" :context="paymentContext"/>
        </template>
        <template v-else>
            <p>{{ $t('85419eed-40f0-4829-ab24-7fef6ec860cc') }}</p>
            <STErrorsDefault :error-box="errors.errorBox"/>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useDismiss, useNavigationController, usePopup, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, NavigationActions, PaymentHandler, PaymentSelectionList, SaveView, STErrorsDefault, Toast, useErrors, useNavigationActions } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { OrderData, OrderResponse, Payment, PaymentMethod } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';
import OrderView from '../orders/OrderView.vue';

const loading = ref(false);
const errors = useErrors();
const popup = usePopup();
const dismiss = useDismiss();
const present = usePresent();
const navigationActions = useNavigationActions();
const navigationController = useNavigationController();
const checkoutManager = useCheckoutManager();
const webshopManager = useWebshopManager();

const title = computed(() => {
    if (checkout.value.totalPrice > 0) {
        return 'Kies je betaalmethode';
    }
    return 'Bevestig jouw bestelling';
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

async function goToOrder(id: string, args: NavigationActions) {
    // Force reload webshop (stock will have changed: prevent invalidating the cart)
    // Update stock in background
    webshopManager.reload().catch((e) => {
        console.error(e);
    });

    if (!popup) {
        // We are not in a popup: on mobile
        // So replace with a force instead of dimissing
        await args.present({
            components: [
                new ComponentWithProperties(OrderView, { orderId: id, success: true }, {
                    provide: {
                        reactive_navigation_url: 'order/' + id,
                    },
                }),
            ],
            replace: 1,
            force: true,

        });
    }
    else {
        // Desktop: push
        await args.dismiss({ force: true })
        await args.present({
            components: [
                new ComponentWithProperties(OrderView, { orderId: id, success: true }, {
                    provide: {
                        reactive_navigation_url: 'order/' + id,
                    },
                }),
            ],
        });
    }
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
        data.consumerLanguage = I18nController.shared?.language ?? 'nl';
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
    }
    catch (e) {
        let error = e;

        if (isSimpleError(e)) {
            error = new SimpleErrors(e);
        }

        if (isSimpleErrors(error)) {
            if (error.hasFieldThatStartsWith('cart')) {
                // A cart error: force a reload and go back to the cart.
                await webshopManager.reload();

                if (webshop.value.meta.cartEnabled) {
                    navigationController.value!.popToRoot({ force: true }).catch(e => console.error(e));
                }
                else {
                    dismiss({ force: true }).catch(console.error);
                }
                Toast.fromError(e).show();
            }
            else if (error.hasFieldThatStartsWith('fieldAnswers')) {
                // A cart error: force a reload and go back to the cart.
                await webshopManager.reload();

                if (webshop.value.meta.cartEnabled) {
                    navigationController.value!.popToRoot({ force: true }).catch(e => console.error(e));
                }
                else {
                    dismiss({ force: true }).catch(console.error);
                }

                Toast.fromError(e).show();
            }
        }
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}
</script>
