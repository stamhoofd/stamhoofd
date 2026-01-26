<template>
    <STList v-if="customers.length">
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
                    {{ $t('Naam ontbreekt') }}
                </p>

                <p v-if="customer.email && customer.email !== customer.dynamicName" class="style-description-small">
                    {{ customer.email }}
                </p>

                <p class="style-description-small">
                    {{ $t('Particulier') }}
                </p>
            </template>
        </RadioListItem>

        <RadioListItem v-model="selectedCustomer" :label="$t('Andere')" :value="null" />
    </STList>

    <div v-if="selectedCustomer === null">
        <STInputBox :title="$t('Type')" class="max">
            <STList>
                <RadioListItem v-model="hasCompany" :label="$t('Bedrijf of vereniging')" :value="true" />
                <RadioListItem v-model="hasCompany" :label="$t('Particulier')" :value="false" />
            </STList>
        </STInputBox>

        <CompanyInputBox v-if="customer.company" :validator="validator" :company="customer.company" @patch:company="addPatch({ company: $event })" />
    </div>
</template>

<script lang="ts" setup>
import { RadioListItem, STInputBox, useEmitPatch, Validator } from '@stamhoofd/components';
import { CompanyInputBox } from '@stamhoofd/components';
import { Company, PaymentCustomer } from '@stamhoofd/structures';
import { computed, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
    customers?: PaymentCustomer[];
    customer: PaymentCustomer;
    validator: Validator;
}>(), {
    customers: () => [],
});

const selectedCustomer = ref<null | PaymentCustomer>(null);

const emit = defineEmits(['patch']);
const { addPatch } = useEmitPatch<PaymentCustomer>(props, emit, 'customer');

watch(() => props.customers, () => {
    const v = props.customer;
    if (v) {
        selectedCustomer.value = props.customers.find(c => c.equals(v)) ?? null;
    }
});

const hasCompany = computed({
    get: () => !!props.customer.company,
    set: (enabled: boolean) => {
        if (enabled === !!props.customer.company) {
            return;
        }
        if (enabled) {
            addPatch({
                company: Company.create({}),
            });
        }
        else {
            addPatch({
                company: null,
            });
        }
    },
});

</script>
