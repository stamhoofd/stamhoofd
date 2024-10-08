<template>
    <div>
        <STList v-if="dateRanges.length > 0">
            <STListItem v-for="_dateRange in dateRanges" :key="_dateRange.id" element-name="label" :selectable="true" class="left-center dateRange-selection">
                <template #left>
                    <Radio v-model="selectedDateRange" :value="_dateRange" @change="changeSelected" />
                </template>
                <h3>
                    {{ formatDate(_dateRange) }}
                </h3>
                <template #right>
                    <button type="button" class="button icon gray edit" @click.stop="doEditDateRange(_dateRange)" />
                </template>
            </STListItem>
            <STListItem element-name="label" :selectable="true" class="left-center">
                <template #left>
                    <Radio v-model="selectedDateRange" :value="null" @change="changeSelected" />
                </template>
                Een andere datum/tijdstip
            </STListItem>
        </STList>
        <ProductDateRangeInput v-if="editingDateRange || selectedDateRange === null" v-model="editDateRange" :validator="internalValidator" />
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput, ErrorBox, Radio, STErrorsDefault, STInputBox, STList, STListItem, Validator } from '@stamhoofd/components';
import { ProductDateRange } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, VueComponent, Watch } from '@simonbackx/vue-app-navigation/classes';

import ProductDateRangeInput from './ProductDateRangeInput.vue';

@Component({
    components: {
        STInputBox,
        STListItem,
        STErrorsDefault,
        Radio,
        AddressInput,
        STList,
        ProductDateRangeInput,
    },
})
export default class ProductSelectDateRangeInput extends VueComponent {
    @Prop({ default: '' })
    title: string;

    @Prop({ required: true })
    dateRanges: ProductDateRange[];

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null })
    validator: Validator | null;

    errorBox: ErrorBox | null = null;

    internalValidator = new Validator();

    @Prop({ default: null })
    modelValue: ProductDateRange | null;

    selectedDateRange: ProductDateRange | null = null;
    customDateRange: ProductDateRange | null = null;
    editingDateRange = false;

    @Watch('modelValue')
    onValueChanged(val: ProductDateRange | null) {
        if (val === (this.selectedDateRange ?? this.customDateRange ?? null)) {
            // Not changed
            return;
        }

        if (!val) {
            return;
        }

        const a = this.dateRanges.find(aa => aa.id === val.id);
        if (a) {
            this.selectedDateRange = a;
            if (this.editingDateRange) {
                this.customDateRange = a;
            }
            else {
                this.customDateRange = null;
            }
        }
        else {
            this.selectedDateRange = null;
            this.editingDateRange = false;
            this.customDateRange = val;
        }
    }

    formatDate(range: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(range.toString());
    }

    mounted() {
        const a = this.dateRanges.find(aa => aa.id === this.modelValue?.id);
        if (a) {
            this.selectedDateRange = a;
            this.editingDateRange = false;
            this.customDateRange = null;
        }
        else {
            this.selectedDateRange = null;
            this.editingDateRange = false;
            this.customDateRange = this.modelValue;

            if (!this.modelValue) {
                if (this.dateRanges.length > 0) {
                    this.$emit('update:modelValue', this.dateRanges[0]);
                }
                else {
                    this.$emit('update:modelValue', ProductDateRange.create({
                        startDate: new Date(),
                        endDate: new Date(),
                    }));
                }
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
        console.log('ChangeSelected');
        if (this.editingDateRange) {
            this.customDateRange = null;
        }
        this.editingDateRange = false;

        let a = this.selectedDateRange ?? this.customDateRange;
        if (!a) {
            // Create a new custom one
            a = this.customDateRange = ProductDateRange.create({
                startDate: this.dateRanges[this.dateRanges.length - 1]?.startDate ?? new Date(),
                endDate: this.dateRanges[this.dateRanges.length - 1]?.endDate ?? new Date(),
            });
        }
        if (a) {
            this.$emit('update:modelValue', a);
        }
    }

    doEditDateRange(dateRange: ProductDateRange) {
        this.$emit('update:modelValue', dateRange);
        this.editingDateRange = true;
        this.selectedDateRange = dateRange;
        this.customDateRange = dateRange;
    }

    get editDateRange() {
        return this.customDateRange;
    }

    set editDateRange(dateRange: ProductDateRange | null) {
        if (this.editingDateRange && this.selectedDateRange && dateRange) {
            this.$emit('modify', { from: this.selectedDateRange, to: dateRange });
            this.selectedDateRange = dateRange;
            this.$emit('update:modelValue', dateRange);
            this.editingDateRange = true;
        }
        else {
            this.$emit('update:modelValue', dateRange);
        }
        this.customDateRange = dateRange;
    }

    async isValid(): Promise<boolean> {
        const isValid = await this.internalValidator.validate();
        if (!isValid) {
            this.errorBox = null;
            return false;
        }

        if (this.selectedDateRange) {
            this.$emit('update:modelValue', this.selectedDateRange);
            this.errorBox = null;
            return true;
        }

        if (!this.customDateRange) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                message: 'Kies een datum',
                field: 'dateRange',
            }));
            return false;
        }

        this.errorBox = null;
        this.$emit('update:modelValue', this.customDateRange);
        return true;
    }
}
</script>
