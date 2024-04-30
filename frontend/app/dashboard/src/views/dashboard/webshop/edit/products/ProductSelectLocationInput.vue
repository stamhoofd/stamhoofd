<template>
    <div>
        <STList v-if="locations.length > 0">
            <STListItem v-for="_location in locations" :key="_location.id" element-name="label" :selectable="true" class="left-center location-selection">
                <Radio #left v-model="selectedLocation" :value="_location" @change="changeSelected" />
                <h3 class="style-title-list">
                    {{ _location.name }}
                </h3>
                <p v-if="_location.address" class="style-description">
                    {{ _location.address }}
                </p>
                <template #right><button type="button" class="button icon gray edit" @click.stop="doEditLocation(_location)" /></template>
            </STListItem>
            <STListItem element-name="label" :selectable="true" class="left-center">
                <Radio #left v-model="selectedLocation" :value="null" @change="changeSelected" />
                Een andere locatie
            </STListItem>
        </STList>
        <ProductLocationInput v-if="editingLocation || selectedLocation === null" v-model="editLocation" :validator="internalValidator" />
        <STErrorsDefault :error-box="errorBox" />
    </div>
</template>


<script lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { AddressInput,ErrorBox, Radio,STErrorsDefault, STInputBox, STList,STListItem,Validator } from "@stamhoofd/components"
import { I18nController } from '@stamhoofd/frontend-i18n';
import { Address, Country, ProductLocation } from "@stamhoofd/structures"
import { Component, Prop, Vue, Watch } from "vue-property-decorator";

import ProductLocationInput from "./ProductLocationInput.vue"

@Component({
    components: {
        STInputBox,
        STListItem,
        STErrorsDefault,
        Radio,
        AddressInput,
        STList,
        ProductLocationInput
    }
})
export default class ProductSelectLocationInput extends Vue {
    @Prop({ required: true }) 
        locations: ProductLocation[];

    /**
     * Assign a validator if you want to offload the validation to components
     */
    @Prop({ default: null }) 
        validator: Validator | null

    errorBox: ErrorBox | null = null

    internalValidator = new Validator()
    
    @Prop({ default: null })
        value: ProductLocation | null

    selectedLocation: ProductLocation | null = null
    customLocation: ProductLocation | null = null
    editingLocation = false

    @Watch('value')
    onValueChanged(val: ProductLocation | null) {
        if (val === this.selectedLocation ?? this.customLocation ?? null) {
            // Not changed
            return
        }

        if (!val) {
            return
        }
        
        const a = this.locations.find(aa => aa.id == val.id)
        if (a) {
            this.selectedLocation = a
            if (this.editingLocation) {
                this.customLocation = a
            } else {
                this.customLocation = null
            }
        } else {
            this.selectedLocation = null
            this.editingLocation = false
            this.customLocation = val
        }
    }

    mounted() {
        const a = this.locations.find(aa => aa.id == this.value?.id)
        if (a) {
            this.selectedLocation = a
            this.editingLocation = false
            this.customLocation = null
        } else {
            this.selectedLocation = null
            this.editingLocation = false
            this.customLocation = this.value

            if (!this.value) {
                if (this.locations.length > 0) {
                    this.$emit('update:modelValue', this.locations[0])
                } else {
                    this.$emit('update:modelValue', ProductLocation.create({
                        name: "",
                        address: Address.createDefault(I18nController.shared?.country ?? Country.Belgium)
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
        if (this.editingLocation) {
            this.customLocation = null
        }
        this.editingLocation = false

        let a = this.selectedLocation ?? this.customLocation
        if (!a) {
            // Create a new custom one
            a = this.customLocation = ProductLocation.create({
                name: "",
                address: Address.createDefault(I18nController.shared?.country ?? Country.Belgium)
            })
        }
        if (a) {
            this.$emit('update:modelValue', a)
        }
    }

    doEditLocation(location: ProductLocation) {
        this.$emit('update:modelValue', location)
        this.editingLocation = true
        this.selectedLocation = location
        this.customLocation = location
    }

    get editLocation() {
        return this.customLocation
    }

    set editLocation(location: ProductLocation | null) {
        if (this.editingLocation && this.selectedLocation && location) {
            this.$emit("modify", { from: this.selectedLocation, to: location })
            this.selectedLocation = location
            this.$emit('update:modelValue', location)
            this.editingLocation = true
        } else {
            this.$emit('update:modelValue', location)
        }
        this.customLocation = location
    }

    async isValid(): Promise<boolean> {
        const isValid = await this.internalValidator.validate()
        if (!isValid) {
            this.errorBox = null
            return false
        }

        if (this.selectedLocation) {
            this.$emit('update:modelValue', this.selectedLocation)
            this.errorBox = null
            return true
        }

        if (!this.customLocation) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "invalid_field",
                message: "Vul een locatie in",
                field: "location"
            }))
            return false
        }
        
        this.errorBox = null
        this.$emit('update:modelValue', this.customLocation)
        return true
    }
}
</script>