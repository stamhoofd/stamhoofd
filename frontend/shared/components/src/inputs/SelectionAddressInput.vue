<template>
    <div>
        <STInputBox v-if="addresses.length > 0" :title="title || $t(`%de`)" :error-box="errorBox" error-fields="selectedAddress">
            <STList>
                <STListItem v-for="_address in addresses" :key="_address.toString()" element-name="label" :selectable="true" class="left-center address-selection">
                    <template #left>
                        <Radio v-model="selectedAddress" :value="_address" @update:model-value="changeSelected" />
                    </template>
                    {{ _address.street }} {{ _address.number }}<br>
                    {{ _address.postalCode }} {{ _address.city }}
                    <template #right>
                        <button class="button icon gray edit" type="button" @click.stop="doEditAddress(_address)" />
                    </template>
                </STListItem>
                <STListItem element-name="label" :selectable="true" class="left-center">
                    <template #left>
                        <Radio v-model="selectedAddress" :value="null" @update:model-value="changeSelected" />
                    </template>
                    {{ $t('%dd') }}
                </STListItem>
            </STList>
        </STInputBox>
        <AddressInput v-if="editingAddress || selectedAddress === null" v-model="editAddress" :title="selectedAddress === null ? (addresses.length > 0 ? $t(`%df`) : $t(`%Cn`)) : $t(`%dg`)" :validator="internalValidator" :required="false" />
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import type { Address, ValidatedAddress } from '@stamhoofd/structures';
import { computed, getCurrentInstance, ref, watch } from 'vue';

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useValidation } from '../errors/useValidation';
import { Validator } from '../errors/Validator';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import AddressInput from './AddressInput.vue';
import Radio from './Radio.vue';
import STInputBox from './STInputBox.vue';

const model = defineModel<Address | ValidatedAddress | null>({ default: null });

const props = withDefaults(defineProps<{
    title?: string | null;
    addresses: Address[];
    required?: boolean;
    /**
     * Assign a validator if you want to offload the validation to components
     */
    validator?: Validator | null;
}>(), {
    title: null,
    required: true,
    validator: null,
});

const emit = defineEmits<{
    (e: 'modify', value: { from: Address; to: Address }): void;
}>();

const instance = getCurrentInstance();

const errorBox = ref<ErrorBox | null>(null);
const internalValidator = new Validator();

const selectedAddress = ref<Address | null>(null);
const customAddress = ref<Address | null>(null);
const editingAddress = ref(false);

const hasModifyListener = computed(() => !!instance?.vnode.props?.onModify);

watch(model, (val) => {
    if (val === (selectedAddress.value ?? customAddress.value ?? null)) {
        // Not changed
        return;
    }

    if (!val) {
        if (!props.required) {
            selectedAddress.value = null;
            editingAddress.value = false;
            customAddress.value = null;
        }
        return;
    }

    const a = props.addresses.find(aa => aa.toString() === val.toString());
    if (a) {
        selectedAddress.value = a;
        editingAddress.value = false;
        customAddress.value = null;
    }
    else {
        selectedAddress.value = null;
        editingAddress.value = false;
        customAddress.value = val;
    }
});

{
    const a = props.addresses.find(aa => aa.toString() === model.value?.toString());
    if (a) {
        selectedAddress.value = a;
        editingAddress.value = false;
        customAddress.value = null;
    }
    else {
        selectedAddress.value = null;
        editingAddress.value = false;
        customAddress.value = model.value;

        if (props.required && !model.value && props.addresses.length > 0) {
            model.value = props.addresses[0];
        }
    }
}

if (props.validator) {
    useValidation(props.validator, () => isValid());
}

const editAddress = computed<Address | null>({
    get: () => customAddress.value,
    set: (address: Address | null) => {
        if (editingAddress.value && selectedAddress.value && address) {
            emit('modify', { from: selectedAddress.value, to: address });
            selectedAddress.value = address;
            model.value = address;
            editingAddress.value = true;
        }
        else {
            model.value = address;
        }
        customAddress.value = address;
    },
});

function changeSelected() {
    if (editingAddress.value) {
        customAddress.value = null;
    }
    editingAddress.value = false;

    const a = selectedAddress.value ?? customAddress.value;
    if (a) {
        model.value = a;
    }
    else {
        if (!props.required) {
            model.value = null;
        }
    }
}

function doEditAddress(address: Address) {
    if (hasModifyListener.value) {
        model.value = address;
        editingAddress.value = true;
        selectedAddress.value = address;
        customAddress.value = address;
    }
    else {
        editingAddress.value = false;
        selectedAddress.value = null;
        customAddress.value = address;
    }
}

async function isValid(): Promise<boolean> {
    const valid = await internalValidator.validate();
    if (!valid) {
        errorBox.value = null;
        return false;
    }

    if (selectedAddress.value) {
        if (selectedAddress.value.toString() !== model.value?.toString()) {
            model.value = selectedAddress.value;
        }
        errorBox.value = null;
        return true;
    }

    if (props.required && !customAddress.value) {
        errorBox.value = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: $t(`%zC`),
            field: 'address',
        }));
        return false;
    }

    errorBox.value = null;

    if (customAddress.value?.toString() !== model.value?.toString()) {
        model.value = customAddress.value;
    }
    return true;
}
</script>
