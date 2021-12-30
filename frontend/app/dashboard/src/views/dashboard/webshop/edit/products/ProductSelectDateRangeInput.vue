<template>
    <div>
        <STInputBox v-if="dateRanges.length > 0" :title="title" :error-box="errorBox" error-fields="selectedDateRange" class="max">
            <STList>
                <STListItem v-for="_dateRange in dateRanges" :key="_dateRange.id" element-name="label" :selectable="true" class="left-center dateRange-selection">
                    <Radio slot="left" v-model="selectedDateRange" :value="_dateRange" @change="changeSelected" />
                    <h3>
                        {{ formatDate(_dateRange) }}
                    </h3>
                    <button slot="right" type="button" class="button icon gray edit" @click.stop="doEditDateRange(_dateRange)" />
                </STListItem>
                <STListItem element-name="label" :selectable="true" class="left-center">
                    <Radio slot="left" v-model="selectedDateRange" :value="null" @change="changeSelected" />
                    Een andere datum/tijdstip
                </STListItem>
            </STList>
        </STInputBox>
        <ProductDateRangeInput v-if="editingDateRange || selectedDateRange === null" v-model="editDateRange" :validator="internalValidator" />
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>


<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput,ErrorBox, Radio,STErrorsDefault, STInputBox, STList,STListItem,Validator } from "@stamhoofd/components"
import { ProductDateRange } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import ProductDateRangeInput from "./ProductDateRangeInput.vue"

@Component({
    components: {
        STInputBox,
        STListItem,
        STErrorsDefault,
        Radio,
        AddressInput,
        STList,
        ProductDateRangeInput
    }
})
export default class ProductSelectDateRangeInput extends Vue {
    @Prop({ default: "" }) 
    title: string;

    @Prop({ required: true }) 
    dateRanges: ProductDateRange[];

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
    validator: Validator | null

    errorBox: ErrorBox | null = null

    internalValidator = new Validator()
    
    @Prop({ default: null })
    value: ProductDateRange | null

    selectedDateRange: ProductDateRange | null = null
    customDateRange: ProductDateRange | null = null
    editingDateRange = false

    @Watch('value')
    onValueChanged(val: ProductDateRange | null) {
        if (val === this.selectedDateRange ?? this.customDateRange ?? null) {
            // Not changed
            return
        }

        if (!val) {
            return
        }
        
        const a = this.dateRanges.find(aa => aa.id == val.id)
        if (a) {
            this.selectedDateRange = a
            if (this.editingDateRange) {
                this.customDateRange = a
            } else {
                this.customDateRange = null
            }
        } else {
            this.selectedDateRange = null
            this.editingDateRange = false
            this.customDateRange = val
        }
    }

    formatDate(range: ProductDateRange) {
        return Formatter.capitalizeFirstLetter(range.toString())
    }

    mounted() {
        const a = this.dateRanges.find(aa => aa.id == this.value?.id)
        if (a) {
            this.selectedDateRange = a
            this.editingDateRange = false
            this.customDateRange = null
        } else {
            this.selectedDateRange = null
            this.editingDateRange = false
            this.customDateRange = this.value

            if (!this.value) {
                if (this.dateRanges.length > 0) {
                    this.$emit("input", this.dateRanges[0])
                } else {
                    this.$emit("input", ProductDateRange.create({
                        startDate: new Date(),
                        endDate: new Date(),
                    }))
                }
            }
        }

        if (this.validator) {
            this.validator.addValidation(this, () => {
                return this.isValid()
            })
        }
    }

    destroyed() {
        if (this.validator) {
            this.validator.removeValidation(this)
        }
    }

    changeSelected() {
        console.log("ChangeSelected")
        if (this.editingDateRange) {
            this.customDateRange = null
        }
        this.editingDateRange = false

        let a = this.selectedDateRange ?? this.customDateRange
        if (!a) {
            // Create a new custom one
            a = this.customDateRange = ProductDateRange.create({
                startDate: this.dateRanges[this.dateRanges.length - 1]?.startDate ?? new Date(),
                endDate: this.dateRanges[this.dateRanges.length - 1]?.endDate ?? new Date(),
            })
        }
        if (a) {
            this.$emit("input", a)
        }
    }

    doEditDateRange(dateRange: ProductDateRange) {
        this.$emit("input", dateRange)
        this.editingDateRange = true
        this.selectedDateRange = dateRange
        this.customDateRange = dateRange
    }

    get editDateRange() {
        return this.customDateRange
    }

    set editDateRange(dateRange: ProductDateRange | null) {
        if (this.editingDateRange && this.selectedDateRange && dateRange) {
            this.$emit("modify", { from: this.selectedDateRange, to: dateRange })
            this.selectedDateRange = dateRange
            this.$emit("input", dateRange)
            this.editingDateRange = true
        } else {
            this.$emit("input", dateRange)
        }
        this.customDateRange = dateRange
    }

    async isValid(): Promise<boolean> {
        const isValid = await this.internalValidator.validate()
        if (!isValid) {
            this.errorBox = null
            return false
        }

        if (this.selectedDateRange) {
            this.$emit("input", this.selectedDateRange)
            this.errorBox = null
            return true
        }

        if (!this.customDateRange) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "invalid_field",
                message: "Vul een locatie in",
                field: "dateRange"
            }))
            return false
        }
        
        this.errorBox = null
        this.$emit("input", this.customDateRange)
        return true
    }
}
</script>