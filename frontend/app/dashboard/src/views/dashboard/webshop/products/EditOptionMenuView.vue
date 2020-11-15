<template>
    <div class="st-view optionmenu-edit-view">
        <STNavigationBar :title="isNew ? 'Keuzemenu toevoegen' : name+' bewerken'">
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Keuzemenu toevoegen
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
                    placeholder="bv. Kies je extra's"
                    autocomplete=""
                >
            </STInputBox>

            <Checkbox v-model="multipleChoice">
                Meerkeuze
            </Checkbox>
            <p class="style-description">Bij meerkeuze kan men geen, één of meerdere keuzes aanduiden. In het andere geval moet er exact één keuze gemaakt worden (of je voegt nog een extra optie 'geen' toe).</p>

            <hr>
            <h2 class="style-with-button">
                <div>Keuzes</div>
                <div>
                    <button class="button text" @click="addOption">
                        <span class="icon add" />
                        <span>Keuze</span>
                    </button>
                </div>
            </h2>
            
            <OptionMenuOptions :option-menu="patchedOptionMenu" @patch="addOptionMenuPatch" />
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
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, ErrorBox, PriceInput, Radio, RadioGroup, SegmentedControl, Slider, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, UploadButton, Validator } from "@stamhoofd/components";
import { Option, OptionMenu, Product, ProductPrice, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import EditOptionView from './EditOptionView.vue';

import EditProductPriceView from './EditProductPriceView.vue';
import OptionMenuOptions from "./OptionMenuOptions.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        Slider,
        Spinner,
        UploadButton,
        OptionMenuOptions,
        STList
    },
})
export default class EditOptionMenuView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    product!: Product

    @Prop({ required: true })
    optionMenu: OptionMenu

    patchProduct: AutoEncoderPatchType<Product> = Product.patch({ id: this.product.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<Product>) => void;

    get patchedProduct() {
        return this.product.patch(this.patchProduct)
    }

    get patchedOptionMenu() {
        const c = this.patchedProduct.optionMenus.find(c => c.id == this.optionMenu.id)
        if (c) {
            return c
        }
        return this.optionMenu
    }

    get isNew() {
        return this.optionMenu.name.length == 0
    }

    get name() {
        return this.patchedOptionMenu.name
    }

    set name(name: string) {
        this.addOptionMenuPatch(OptionMenu.patch({ name }))
    }

    get multipleChoice() {
        return this.patchedOptionMenu.multipleChoice
    }

    set multipleChoice(multipleChoice: boolean) {
        this.addOptionMenuPatch(OptionMenu.patch({ multipleChoice }))
    }

    addOptionMenuPatch(patch: AutoEncoderPatchType<OptionMenu>) {
        const p = Product.patch({})
        p.optionMenus.addPatch(OptionMenu.patch(Object.assign({}, patch, { id: this.optionMenu.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<Product>) {
        this.patchProduct = this.patchProduct.patch(patch)
    }

    addOption() {
        const option = Option.create({})
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPut(option)
        
        this.present(new ComponentWithProperties(EditOptionView, { optionMenu: this.patchedOptionMenu.patch(p), option, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
            // Merge both patches
            this.addOptionMenuPatch(p.patch(patch))

            // todo: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        }}).setDisplayStyle("sheet"))
    }


    save() {
        this.saveHandler(this.patchProduct)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit keuzemenu wilt verwijderen?", "Verwijderen")) {
            return
        }

        const p = Product.patch({})
        p.optionMenus.addDelete(this.optionMenu.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;
@use "@stamhoofd/scss/base/variables.scss" as *;


</style>
