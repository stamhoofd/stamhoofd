<template>
    <STList v-if="customers.length > 0">
        <RadioListItem v-for="(customer, index) of customers" :key="index" v-model="selectedCustomerModel" :label="customer.dynamicName" :value="customer">
            <template v-if="customer.company">
                <p v-if="customer.company.VATNumber" class="style-description-small">
                    {{ customer.company.VATNumber }} {{ $t('%Gn') }}
                </p>
                <p v-else-if="customer.company.companyNumber" class="style-description-small">
                    {{ customer.company.companyNumber }} {{ $t('%eS') }}
                </p>
                <p v-else class="style-description-small">
                    {{ $t('%1CH') }}
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
                    {{ $t('%1JF') }}
                </p>

                <p v-if="customer.email && customer.email !== customer.dynamicName" class="style-description-small">
                    {{ customer.email }}
                </p>

                <p class="style-description-small">
                    {{ $t('%1J8') }}
                </p>
            </template>
        </RadioListItem>

        <RadioListItem v-model="selectedCustomerModel" :label="$t('%1JG')" :value="null" />
    </STList>

    <template v-if="customers.length > 0 && selectedCustomerModel === null">
        <hr>
        <h2>{{ $t('%1KX') }}</h2>
    </template>
    <PaymentCustomerInput v-if="selectedCustomerModel === null || customers.length <= 0" :customer="mappedCustomer" :validator="validator" :error-box="errorBox" @patch:customer="addPatch" />
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox.ts';
import RadioListItem from '#inputs/RadioListItem.vue';
import { useEmitPatch } from '#hooks/useEmitPatch.ts';
import { Validator } from '#errors/Validator.ts';
import { PaymentCustomer } from '@stamhoofd/structures';
import { computed, ref, watch } from 'vue';
import PaymentCustomerInput from './PaymentCustomerInput.vue';
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';

const props = withDefaults(defineProps<{
    customers?: PaymentCustomer[];
    customer: PaymentCustomer | null;
    validator: Validator;
    errorBox?: ErrorBox | null;
}>(), {
    customers: () => [],
    errorBox: null,
});

const mappedCustomer = computed(() => {
    return props.customer ?? PaymentCustomer.create({});
});
const selectedCustomer = ref<null | PaymentCustomer>(null);
const selectedCustomerModel = computed({
    get: () => {
        // Avoid radio state not selecting customer if references change in props
        const d = selectedCustomer.value;
        const existing = d ? props.customers.find(c => c.equals(d)) : null;
        return existing ?? d;
    },
    set: (v: PaymentCustomer | null) => {
        selectedCustomer.value = v;

        if (v) {
            addPatch(v);
        }
        else {
            manualSet = true;
        }
    },
});

const emit = defineEmits(['patch:customer']);
const { addPatch: emitAddPatch } = useEmitPatch<PaymentCustomer>(props, emit, 'customer');
function addPatch(d: PartialWithoutMethods<AutoEncoderPatchType<PaymentCustomer>>) {
    if (props.customer === null) {
        // Emit full edit
        emitAddPatch(mappedCustomer.value.patch(d));
        return;
    }
    emitAddPatch(d);
}
let manualSet = false;

watch(() => props.customers, () => {
    const v = props.customer;
    if (v && !manualSet) {
        // alter without calling patch
        selectedCustomer.value = props.customers.find(c => c.equals(v)) ?? null;
    }
    else if (!v && !manualSet && props.customers.length) {
        selectedCustomerModel.value = props.customers[0];
    }
}, { immediate: true });

</script>
