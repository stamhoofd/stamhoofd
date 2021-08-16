<template>
    <div>
        <div class="split-inputs">
            <STInputBox title="Startdatum" error-fields="startDate" :error-box="errorBox">
                <DateSelection v-model="startDate" />
            </STInputBox>
            <TimeInput v-model="startDate" title="Vanaf welk tijdstip" :validator="validator" />
        </div>
        <div class="split-inputs">
            <STInputBox title="Einddatum" error-fields="endDate" :error-box="errorBox">
                <DateSelection v-model="endDate" />
            </STInputBox>
            <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
        </div>
    </div>
</template>

<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { DateSelection, ErrorBox, STInputBox, TimeInput, Validator } from "@stamhoofd/components"
import { ProductDateRange} from "@stamhoofd/structures"
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

@Component({
    components: {
        STInputBox,
        DateSelection,
        TimeInput
    }
})
export default class ProductDateRangeInput extends Vue {
    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
    validator: Validator | null

    errorBox: ErrorBox | null = null
    
    @Prop({ default: null })
    value: ProductDateRange | null

    mounted() {
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

    get startDate() {
        return this.value?.startDate ?? new Date()
    }

    set startDate(startDate: Date) {
        if (this.value) {
            this.$emit("input", this.value.patch({ startDate }))
        }
    }

    get endDate() {
        return this.value?.endDate ?? new Date()
    }

    set endDate(endDate: Date) {
        if (this.value) {
            this.$emit("input", this.value.patch({ endDate }))
        }
    }

    async isValid(): Promise<boolean> {
        await Promise.resolve()
        if (this.startDate > this.endDate) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "invalid_field",
                field: "endDate",
                message: "De einddatum en tijdstip die je hebt ingevuld ligt voor de startdatum en tijdstip"
            }))
            return false
        }

        return true
    }
}
</script>