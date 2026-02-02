<template>
    <STList v-if="customers.length > 1">
        <RadioListItem v-for="(customer, index) of customers" :key="index" v-model="selectedCustomer" :label="customer.dynamicName" :value="customer">
            <template v-if="customer.company">
                <p v-if="customer.company.VATNumber" class="style-description-small">
                    {{ customer.company.VATNumber }} {{ $t('9f72f8ee-74c7-4757-b1dc-948f632114f2') }}
                </p>
                <p v-else-if="customer.company.companyNumber" class="style-description-small">
                    {{ customer.company.companyNumber }} {{ $t('d127a845-d79d-4bd5-9335-a302123f56a0') }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('594307a3-05b8-47cf-81e2-59fb6254deba') }}
                </p>

                <p v-if="customer.company.address" class="style-description-small">
                    {{ customer.company.address.shortString() }}
                </p>

                <p v-if="customer.company.administrationEmail" class="style-description-small">
                    {{ customer.company.administrationEmail }}
                </p>
            </template>
            <template v-else>
                <p v-if="customer.phone" class="style-description-small">
                    {{ customer.phone }}
                </p>

                <p v-if="!customer.name" class="style-description-small">
                    {{ $t('e20260ab-00a7-4acf-8dc8-938a4c0249d7') }}
                </p>

                <p v-if="customer.email && customer.email !== customer.dynamicName" class="style-description-small">
                    {{ customer.email }}
                </p>

                <p class="style-description-small">
                    {{ $t('1474bb78-8f01-456a-9e85-c6b1748b76d5') }}
                </p>
            </template>
        </RadioListItem>

        <RadioListItem v-model="selectedCustomer" :label="$t('26677608-996f-41a5-8a53-543d6efa7de4')" :value="null" />
    </STList>

    <template v-if="customers.length > 1 && selectedCustomer === null">
        <hr>
        <h2>{{ $t('37bdf570-09b9-4f44-a48c-b8f3a3c698ce') }}</h2>
    </template>
    <PaymentCustomerInput v-if="selectedCustomer === null || customers.length <= 1" :customer="customer" :validator="validator" :error-box="errorBox" @patch:customer="addPatch" />
</template>

<script lang="ts" setup>
import { ErrorBox, RadioListItem, useEmitPatch, Validator } from '@stamhoofd/components';
import { PaymentCustomer } from '@stamhoofd/structures';
import { ref, watch } from 'vue';
import PaymentCustomerInput from './PaymentCustomerInput.vue';

const props = withDefaults(defineProps<{
    customers?: PaymentCustomer[];
    customer: PaymentCustomer;
    validator: Validator;
    errorBox?: ErrorBox | null;
}>(), {
    customers: () => [],
    errorBox: null,
});

const selectedCustomer = ref<null | PaymentCustomer>(null);

const emit = defineEmits(['patch']);
const { addPatch } = useEmitPatch<PaymentCustomer>(props, emit, 'customer');
let manualSet = false;

watch(() => props.customers, () => {
    const v = props.customer;
    if (v && !manualSet) {
        selectedCustomer.value = props.customers.find(c => c.equals(v)) ?? null;
    }
}, { immediate: true });

watch(selectedCustomer, (v) => {
    if (v === null) {
        manualSet = true;
    }
}, { immediate: false, deep: false });

</script>
