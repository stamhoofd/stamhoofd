<template>
    <div>
        <STInputBox v-if="addresses.length > 0" :title="title || 'Kies een adres'" :error-box="errorBox" error-fields="selectedAddress">
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
                    Een ander adres ingeven
                </STListItem>
            </STList>
        </STInputBox>
        <AddressInput v-if="editingAddress || selectedAddress === null" v-model="editAddress" :title="selectedAddress === null ? (addresses.length > 0 ? 'Nieuw adres' : 'Adres') : 'Adres bewerken'" :validator="internalValidator" :required="false" />
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';
import { Address, ValidatedAddress } from '@stamhoofd/structures';

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { Validator } from '../errors/Validator';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import AddressInput from './AddressInput.vue';
import Radio from './Radio.vue';
import STInputBox from './STInputBox.vue';

@Component({
    components: {
        STInputBox,
        STListItem,
        STErrorsDefault,
        Radio,
        AddressInput,
        STList,
    },
    emits: ['update:modelValue', 'modify'],
})
export default class SelectionAddressInput extends VueComponent {
    @Prop({ default: null })
    title: string | null;

    @Prop({ required: true })
    addresses: Address[];

    @Prop({ default: true })
    required: boolean;

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null })
    validator: Validator | null;

    errorBox: ErrorBox | null = null;

    internalValidator = new Validator();

    @Prop({ default: null })
    modelValue: Address | ValidatedAddress | null;

    selectedAddress: Address | null = null;
    customAddress: Address | null = null;
    editingAddress = false;

    @Watch('modelValue')
    onValueChanged(val: Address | null) {
        if (val === (this.selectedAddress ?? this.customAddress ?? null)) {
            // Not changed
            return;
        }

        if (!val) {
            if (!this.required) {
                this.selectedAddress = null;
                this.editingAddress = false;
                this.customAddress = null;
            }
            return;
        }

        const a = this.addresses.find(aa => aa.toString() === val.toString());
        if (a) {
            this.selectedAddress = a;
            this.editingAddress = false;
            this.customAddress = null;
        }
        else {
            this.selectedAddress = null;
            this.editingAddress = false;
            this.customAddress = val;
        }
    }

    get hasModifyListener() {
        return !!this.$.vnode.props?.onModify;
    }

    mounted() {
        const a = this.addresses.find(aa => aa.toString() === this.modelValue?.toString());
        if (a) {
            this.selectedAddress = a;
            this.editingAddress = false;
            this.customAddress = null;
        }
        else {
            this.selectedAddress = null;
            this.editingAddress = false;
            this.customAddress = this.modelValue;

            if (this.required && !this.modelValue && this.addresses.length > 0) {
                this.$emit('update:modelValue', this.addresses[0]);
            }
        }

        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid();
            });
        }
    }

    unmounted() {
        if (this.validator) {
            this.validator.removeValidation(this);
        }
    }

    changeSelected() {
        if (this.editingAddress) {
            this.customAddress = null;
        }
        this.editingAddress = false;

        const a = this.selectedAddress ?? this.customAddress;
        if (a) {
            this.$emit('update:modelValue', a);
        }
        else {
            if (!this.required) {
                this.$emit('update:modelValue', null);
            }
        }
    }

    doEditAddress(address: Address) {
        if (this.hasModifyListener) {
            this.$emit('update:modelValue', address);
            this.editingAddress = true;
            this.selectedAddress = address;
            this.customAddress = address;
        }
        else {
            this.editingAddress = false;
            this.selectedAddress = null;
            this.customAddress = address;
        }
    }

    get editAddress() {
        return this.customAddress;
    }

    set editAddress(address: Address | null) {
        if (this.editingAddress && this.selectedAddress && address) {
            this.$emit('modify', { from: this.selectedAddress, to: address });
            this.selectedAddress = address;
            this.$emit('update:modelValue', address);
            this.editingAddress = true;
        }
        else {
            this.$emit('update:modelValue', address);
        }
        this.customAddress = address;
    }

    async isValid(): Promise<boolean> {
        const isValid = await this.internalValidator.validate();
        if (!isValid) {
            this.errorBox = null;
            return false;
        }

        if (this.selectedAddress) {
            if (this.selectedAddress.toString() !== this.modelValue?.toString()) {
                this.$emit('update:modelValue', this.selectedAddress);
            }
            this.errorBox = null;
            return true;
        }

        if (this.required && !this.customAddress) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Vul een adres in',
                field: 'address',
            }));
            return false;
        }

        this.errorBox = null;

        if (this.customAddress?.toString() !== this.modelValue?.toString()) {
            this.$emit('update:modelValue', this.customAddress);
        }
        return true;
    }
}
</script>
