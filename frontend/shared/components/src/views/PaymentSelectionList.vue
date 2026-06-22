<template>
    <div>
        <p v-if="selectedPaymentMethod && getWarning(selectedPaymentMethod)" class="warning-box">
            {{ getWarning(selectedPaymentMethod) }}
        </p>

        <p v-if="sortedPaymentMethods.length === 0" class="error-box">
            {{ $t('%1Zj') }}
        </p>

        <STList v-else class="payment-selection-list">
            <STListItem v-for="paymentMethod in sortedPaymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Radio v-model="selectedPaymentMethod" name="choose-payment-method" :value="paymentMethod" data-testid="payment-method-option" />
                </template>

                <h2 :class="{ 'style-title-list': !!getDescription(paymentMethod) }">
                    {{ getName(paymentMethod) }}

                    <span v-if="paymentMethod === PaymentMethod.Bancontact && bancontactInfoMessage" class="style-tag inline-first">{{ bancontactInfoMessage }}</span>
                </h2>
                <p v-if="getDescription(paymentMethod)" class="style-description-small">
                    {{ getDescription(paymentMethod) }}
                </p>

                <template #right>
                    <PaymentMethodSelectionIcon :method="paymentMethod" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import Radio from '#inputs/Radio.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import type { PaymentConfiguration, PaymentCustomer } from '@stamhoofd/structures';
import { PaymentMethod, PaymentMethodHelper, PaymentType } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import { computed, onMounted } from 'vue';
import PaymentMethodSelectionIcon from '#payments/components/PaymentMethodSelectionIcon.vue';

const props = withDefaults(defineProps<{
    country: Country;
    paymentConfiguration: PaymentConfiguration;
    context?: null | 'takeout' | 'delivery';
    amount: number;
    customer?: PaymentCustomer | null;
    forMandate?: boolean;
}>(), {
    context: null,
    customer: null,
    forMandate: false,
});

const selectedPaymentMethod = defineModel<PaymentMethod | null>();
const paymentMethods = computed(() => props.paymentConfiguration.getAvailablePaymentMethods({
    amount: props.amount,
    customer: props.customer,
    forMandate: props.forMandate,
}));

const bancontactInfoMessage = computed(() => {
    if (hasOtherOnlinePaymentMethodBesidesBancontact.value) {
        if (paymentMethods.value.includes(PaymentMethod.Payconiq)) {
            return $t('%1cD');
        }

        return $t('%kQ');
    }

    return null;
});

const sortedPaymentMethods = computed(() => {
    const methods = paymentMethods.value;
    const r: PaymentMethod[] = [];

    // Force a given ordering
    if (methods.includes(PaymentMethod.iDEAL) && props.country === Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Payconiq)) {
        r.push(PaymentMethod.Payconiq);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Bancontact) && props.country !== Country.Netherlands) {
        r.push(PaymentMethod.Bancontact);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.CreditCard)) {
        r.push(PaymentMethod.CreditCard);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.iDEAL) && props.country !== Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Bancontact) && props.country === Country.Netherlands) {
        r.push(PaymentMethod.Bancontact);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Transfer)) {
        r.push(PaymentMethod.Transfer);
    }

    // Others
    r.push(...methods.filter(p => p != PaymentMethod.Payconiq && p != PaymentMethod.Bancontact && p != PaymentMethod.iDEAL && p != PaymentMethod.CreditCard && p != PaymentMethod.Transfer));

    return r;
});

onMounted(() => {
    if (!selectedPaymentMethod.value || selectedPaymentMethod.value === PaymentMethod.Unknown || !paymentMethods.value.includes(selectedPaymentMethod.value)) {
        selectedPaymentMethod.value = sortedPaymentMethods.value[0] ?? null;
    }
});

const hasOtherOnlinePaymentMethodBesidesBancontact = computed(() => {
    const hasTransfer = paymentMethods.value.includes(PaymentMethod.Transfer) ? 1 : 0;
    const hasPOS = paymentMethods.value.includes(PaymentMethod.PointOfSale) ? 1 : 0;
    return paymentMethods.value.length > (hasTransfer + hasPOS + 1);
});

function getName(paymentMethod: PaymentMethod): string {
    switch (paymentMethod) {
        case PaymentMethod.Payconiq: return 'Bancontact Pay | Wero'; // not translateable
        case PaymentMethod.Transfer: return $t(`%12j`);
        case PaymentMethod.DirectDebit: return $t(`%12k`);
    }
    return PaymentMethodHelper.getNameCapitalized(paymentMethod, props.context);
}

function getDescription(paymentMethod: PaymentMethod): string {
    switch (paymentMethod) {
        case PaymentMethod.Payconiq: {
            if (paymentMethods.value.includes(PaymentMethod.Bancontact)) {
                return '';
            }
            return $t(`%12l`);
        }
        case PaymentMethod.Transfer: return $t(`%12m`);
        case PaymentMethod.Bancontact: return props.country === Country.Belgium ? $t('%1Ou') : '';
        case PaymentMethod.iDEAL: return props.country === Country.Netherlands ? $t(`%12n`) : '';
        case PaymentMethod.Unknown: return '';
        case PaymentMethod.DirectDebit: return $t(`%12o`);
        case PaymentMethod.CreditCard: return '';
        case PaymentMethod.PointOfSale: return '';
        case PaymentMethod.AccountDeductions: return '';
    }
}

function getWarning(paymentMethod: PaymentMethod): string {
    const settings = props.paymentConfiguration.paymentMethodSettings.get(paymentMethod);
    if (settings) {
        if (settings.warningText) {
            if (settings.warningAmount === null || settings.warningAmount <= props.amount) {
                return settings.warningText;
            }
        }
    }
    return '';
}

</script>

<style lang="scss">
.payment-selection-list {
    .payment-method-logo {
        max-height: 30px;

        &.bancontact {
            max-height: 38px;
            margin: -4px 0 !important; // Fix white borders in bancontact logo
        }
    }

    .payment-app-logo {
        height: 28px;
        width: 28px;
    }

    .payment-app-banner {
        display: flex;
        flex-direction: row;
        padding-top: 10px;

        > * {
            margin-right: 5px
        }
    }
}

</style>
