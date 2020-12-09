<template>
    <div class="">
        <STInputBox title="Standaard tarief" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" />
        </STInputBox>

        <Checkbox v-model="enableReducedPrice">
            Verlaagd tarief voor leden met financiële moeilijkheden
        </Checkbox>
        <STInputBox v-if="enableReducedPrice" title="Verlaagd tarief" error-fields="reducedPrice" :error-box="errorBox">
            <PriceInput v-model="reducedPrice" placeholder="Gratis" />
        </STInputBox>
        
        <Checkbox v-model="enableLatePrice">
            Verlaagd tarief na een bepaalde datum
        </Checkbox>

        <div v-if="enableLatePrice" class="split-inputs">
            <STInputBox title="Verminder het lidgeld vanaf" error-fields="reducedPriceDate" :error-box="errorBox">
                <DateSelection v-model="latePriceDate" />
            </STInputBox>

            <STInputBox title="Standaard tarief na deze datum" error-fields="reducedPriceDate" :error-box="errorBox">
                <PriceInput v-model="latePrice" placeholder="Gratis" />
            </STInputBox>
        </div>

        <STInputBox v-if="enableLatePrice && enableReducedPrice" title="Verlaagd tarief na deze datum" error-fields="reducedLatePrice" :error-box="errorBox">
            <PriceInput v-model="reducedLatePrice" placeholder="Gratis" />
        </STInputBox>

        <Checkbox v-model="enableFamilyPrice">
            Verlaagd tarief voor broers/zussen
        </Checkbox>
        <div v-if="enableFamilyPrice" class="split-inputs">
            <STInputBox title="Voor tweede broer/zus" error-fields="reducedPrice" :error-box="errorBox">
                <PriceInput v-model="familyPrice" placeholder="Gratis" />
            </STInputBox>
            <STInputBox title="Daaropvolgende broers/zussen" error-fields="reducedPrice" :error-box="errorBox">
                <PriceInput v-model="extraFamilyPrice" placeholder="Gratis" />
            </STInputBox>
        </div>
        <p v-if="enableFamilyPrice" class="style-description">
            Als meerdere verlaagde tarieven van toepassing zijn wordt automatisch het laagste gekozen.
        </p>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AgeInput, Checkbox, DateSelection, ErrorBox, FemaleIcon, MaleIcon, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Organization, WaitingListType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        MaleIcon,
        FemaleIcon,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        AgeInput,
        Slider,
        Spinner,
        TimeInput
    },
})
export default class EditGroupPriceBox extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    validator: Validator

    @Prop({ default: null })
    errorBox: ErrorBox | null

    /**
     * This array will get changed by emitting patch events that contain a patchablearray
     */
    @Prop({ default: () => [] })
    prices!: GroupPrices[]

    getPricesPatch(): PatchableArrayAutoEncoder<GroupPrices> {
        return new PatchableArray()
    }

    addPatch(patch: PatchableArrayAutoEncoder<GroupPrices>) {
        this.$emit("patch", patch)
    }

    get price() {
        return this.prices.find(p => p.startDate == null)?.price ?? 0
    }

    set price(price: number) {
        const p = this.prices.find(p => p.startDate == null)

        if (!p) {
            const patch = this.getPricesPatch()
            patch.addPut(GroupPrices.create({ price }))
            this.addPatch(patch)
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, price }))
            this.addPatch(patch)
        }
    }

    get enableReducedPrice() {
        return !!this.prices.find(p => p.reducedPrice !== null)
    }

    set enableReducedPrice(enable: boolean) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            if (!enable) {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, reducedPrice: null}))
            } else {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, reducedPrice: price.price}))
            }
        }

        this.addPatch(patch)
    }

    get enableFamilyPrice() {
        return !!this.prices.find(p => p.familyPrice !== null)
    }

    set enableFamilyPrice(enable: boolean) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            if (!enable) {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice: null, extraFamilyPrice: null }))
            } else {
                patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice: price.price, extraFamilyPrice: price.price }))
            }
        }

        this.addPatch(patch)
    }

    get familyPrice() {
        return this.prices.find(p => p.startDate == null)?.familyPrice ?? 0
    }

    set familyPrice(familyPrice: number) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            patch.addPatch(GroupPrices.patchType().create({ id: price.id, familyPrice }))
        }

        this.addPatch(patch)
    }

    get extraFamilyPrice() {
        return this.prices.find(p => p.startDate == null)?.extraFamilyPrice ?? 0
    }

    set extraFamilyPrice(extraFamilyPrice: number) {
        const patch = this.getPricesPatch()

        for (const price of this.prices) {
            patch.addPatch(GroupPrices.patchType().create({ id: price.id, extraFamilyPrice }))
        }

        this.addPatch(patch)
    }

    get reducedPrice() {
        return this.prices.find(p => p.startDate == null)?.reducedPrice ?? 0
    }

    set reducedPrice(reducedPrice: number) {
        const p = this.prices.find(p => p.startDate == null)

        if (!p) {
            const patch = this.getPricesPatch()
            patch.addPut(GroupPrices.create({ reducedPrice }))
            this.addPatch(patch)
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, reducedPrice }))
            this.addPatch(patch)
        }
    }

    get enableLatePrice() {
        return !!this.prices.find(p => p.startDate !== null)
    }

    set enableLatePrice(enable: boolean) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!enable) {
            if (p) {
                const patch = this.getPricesPatch()
                patch.addDelete(p.id)
                this.addPatch(patch)
            }
            return
        } else {
            if (!p) {
                const patch = this.getPricesPatch()
                // todo: better default date
                patch.addPut(GroupPrices.create({ 
                    startDate: new Date(), 
                    price: this.price, 
                    reducedPrice: this.enableReducedPrice ? this.reducedPrice : null, 
                    familyPrice: this.enableFamilyPrice ? this.familyPrice : null, 
                    extraFamilyPrice: this.enableFamilyPrice ? this.extraFamilyPrice : null
                }))
                this.addPatch(patch)
            }
        }
    }

    get latePrice() {
        return this.prices.find(p => p.startDate !== null)?.price ?? 0
    }

    set latePrice(price: number) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, price }))
            this.addPatch(patch)
        }
    }

    get reducedLatePrice() {
        return this.prices.find(p => p.startDate !== null)?.reducedPrice ?? 0
    }

    set reducedLatePrice(reducedPrice: number) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, reducedPrice }))
            this.addPatch(patch)
        }
    }

    get latePriceDate() {
        return this.prices.find(p => p.startDate !== null)?.startDate ?? new Date()
    }

    set latePriceDate(startDate: Date) {
        const p = this.prices.find(p => p.startDate !== null)

        if (!p) {
            // shouldn't happen
        } else {
            const patch = this.getPricesPatch()
            patch.addPatch(GroupPrices.patchType().create({ id: p.id, startDate }))
            this.addPatch(patch)
        }
    }
}
</script>
