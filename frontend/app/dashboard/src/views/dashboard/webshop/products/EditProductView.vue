<template>
    <div class="st-view product-edit-view">
        <STNavigationBar :title="isNew ? 'Artikel toevoegen' : name+' bewerken'">
            <template slot="right">
                <button class="button text" v-if="!isNew" @click="deleteMe">
                    <span class="icon trash"/>
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
            
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Artikel toevoegen
            </h1>
            <h1 v-else>
                {{ name }} bewerken
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />
            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam van dit artikel"
                    autocomplete=""
                >
            </STInputBox>
           
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AgeInput, Checkbox, DateSelection, ErrorBox, FemaleIcon, MaleIcon, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, Spinner,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Organization, PrivateWebshop, Product, WaitingListType } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

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
        Spinner
    },
})
export default class EditProductView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    product!: Product

    @Prop({ required: true })
    webshop: PrivateWebshop

    patchProduct: AutoEncoderPatchType<Product> = Product.patch({ id: this.product.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedProduct() {
        return this.product.patch(this.patchProduct)
    }

    get isNew() {
        return this.product.name.length == 0
    }

    get name() {
        return this.patchedProduct.name
    }

    set name(name: string) {
        this.patchProduct = this.patchProduct.patch({ name })
    }

    save() {
        const p = PrivateWebshop.patch({})
        p.products.addPatch(this.patchProduct)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    deleteMe() {
        const p = PrivateWebshop.patch({})
        p.products.addDelete(this.product.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        // todo
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.product-edit-view {
    

}
</style>
