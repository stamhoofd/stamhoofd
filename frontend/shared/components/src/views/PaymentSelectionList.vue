<template>
    <div>
        <p v-if="selectedPaymentMethod && getWarning(selectedPaymentMethod)" class="warning-box">
            {{ getWarning(selectedPaymentMethod) }}
        </p>

        <STList class="payment-selection-list">
            <STListItem v-for="paymentMethod in sortedPaymentMethods" :key="paymentMethod" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Radio v-model="selectedPaymentMethod" name="choose-payment-method" :value="paymentMethod" />
                </template>

                <h2 :class="{ 'style-title-list': !!getDescription(paymentMethod) }">
                    {{ getName(paymentMethod) }}

                    <span v-if="paymentMethod === 'Payconiq' && hasNonPayconiq" class="style-tag inline-first">{{ $t('a841013e-9ea0-4c17-9225-31a6a09d98c4') }}</span>
                </h2>
                <p v-if="getDescription(paymentMethod)" class="style-description-small">
                    {{ getDescription(paymentMethod) }}
                </p>

                <div v-if="paymentMethod === 'Payconiq'" class="payment-app-banner">
                    <img class="payment-app-logo" src="@stamhoofd/assets/images/partners/payconiq/app.svg"><img class="payment-app-logo" src="@stamhoofd/assets/images/partners/kbc/app.svg"><img class="payment-app-logo" src="@stamhoofd/assets/images/partners/ing/app.svg"><img class="payment-app-logo" src="@stamhoofd/assets/images/partners/belfius/app.svg"><img class="payment-app-logo" src="@stamhoofd/assets/images/partners/bnp/app.png"><img class="payment-app-logo" src="@stamhoofd/assets/images/partners/hello-bank/app.png"><img class="payment-app-logo" src="@stamhoofd/assets/images/partners/argenta/app.png">
                </div>

                <template #right>
                    <PaymentMethodIcon v-if="(!$isMobile || paymentMethod !== 'Payconiq')" :method="paymentMethod" :type="PaymentType.Payment" />
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { Radio, STList, STListItem } from '@stamhoofd/components';
import { Country, Organization, PaymentConfiguration, PaymentCustomer, PaymentMethod, PaymentMethodHelper, PaymentType } from '@stamhoofd/structures';
import { computed, onMounted } from 'vue';
import PaymentMethodIcon from '../payments/components/PaymentMethodIcon.vue';

const props = withDefaults(defineProps<{
    organization: Organization;
    paymentConfiguration: PaymentConfiguration;
    context?: null | 'takeout' | 'delivery';
    amount: number;
    customer?: PaymentCustomer | null;
}>(), {
    context: null,
    customer: null,
});

const selectedPaymentMethod = defineModel<PaymentMethod | null>();
const paymentMethods = computed(() => props.paymentConfiguration.getAvailablePaymentMethods({
    amount: props.amount,
    customer: props.customer,
}));

const sortedPaymentMethods = computed(() => {
    const methods = paymentMethods.value;
    const r: PaymentMethod[] = [];

    // Force a given ordering
    if (methods.includes(PaymentMethod.iDEAL) && props.organization.address.country === Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Payconiq)) {
        r.push(PaymentMethod.Payconiq);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Bancontact)) {
        r.push(PaymentMethod.Bancontact);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.iDEAL) && props.organization.address.country !== Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.CreditCard)) {
        r.push(PaymentMethod.CreditCard);
    }

    // Force a given ordering
    if (methods.includes(PaymentMethod.Transfer)) {
        r.push(PaymentMethod.Transfer);
    }

    // Others
    r.push(...methods.filter(p => p !== PaymentMethod.Payconiq && p !== PaymentMethod.Bancontact && p !== PaymentMethod.iDEAL && p !== PaymentMethod.CreditCard && p !== PaymentMethod.Transfer));

    return r;
});

onMounted(() => {
    if (!selectedPaymentMethod.value || selectedPaymentMethod.value === PaymentMethod.Unknown || !paymentMethods.value.includes(selectedPaymentMethod.value)) {
        selectedPaymentMethod.value = sortedPaymentMethods.value[0] ?? null;
    }
});

const hasNonPayconiq = computed(() => {
    const hasTransfer = paymentMethods.value.includes(PaymentMethod.Transfer) ? 1 : 0;
    const hasPOS = paymentMethods.value.includes(PaymentMethod.PointOfSale) ? 1 : 0;
    return paymentMethods.value.length > 1 || !!hasTransfer || !!hasPOS;
});

function getName(paymentMethod: PaymentMethod): string {
    switch (paymentMethod) {
        case PaymentMethod.Payconiq: return 'Payconiq by Bancontact';
        case PaymentMethod.Transfer: return $t(`cffa7f10-50e3-4da2-946c-5c60fc3fa2cf`);
        case PaymentMethod.DirectDebit: return $t(`001d60ee-93ad-481d-a264-7ee0d2e6c906`);
    }
    return PaymentMethodHelper.getNameCapitalized(paymentMethod, props.context);
}

function getDescription(paymentMethod: PaymentMethod): string {
    switch (paymentMethod) {
        case PaymentMethod.Payconiq: return $t(`e92b72a2-177b-4a1c-9137-f2e2c6ffe724`);
        case PaymentMethod.Transfer: return $t(`6896f79a-a7f7-423d-9907-491f90a10daa`);
        case PaymentMethod.Bancontact: return props.organization.address.country === Country.Belgium ? '' : '';
        case PaymentMethod.iDEAL: return props.organization.address.country === Country.Netherlands ? $t(`21e54de0-fcb5-44b3-8446-f3e761e0a9b1`) : '';
        case PaymentMethod.Unknown: return '';
        case PaymentMethod.DirectDebit: return $t(`933a58fa-2f3e-4eae-893c-790a3c5b771a`);
        case PaymentMethod.CreditCard: return '';
        case PaymentMethod.PointOfSale: return '';
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
