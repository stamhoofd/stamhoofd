<template>
    <SaveView :title="isNew ? 'Keuzemenu toevoegen' : name+' bewerken'" :disabled="!hasChanges && !isNew" @save="save">
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
        <p class="style-description">
            Bij meerkeuze kan men geen, één of meerdere keuzes aanduiden. In het andere geval moet er exact één keuze gemaakt worden (of je voegt nog een extra optie 'geen' toe).
        </p>

        <hr>
        <h2 class="style-with-button">
            <div>Keuzes</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addOption">
                    <span class="icon add" />
                    <span>Keuze</span>
                </button>
            </div>
        </h2>
            
        <OptionMenuOptions :option-menu="patchedOptionMenu" @patch="addOptionMenuPatch" />

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder dit keuzemenu
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, SaveView, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components";
import { Option, OptionMenu, Product, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import EditOptionView from './EditOptionView.vue';
import OptionMenuOptions from "./OptionMenuOptions.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        OptionMenuOptions,
    },
})
export default class EditOptionMenuView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    product!: Product

    @Prop({ required: true })
    isNew!: boolean

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
        
        this.present(new ComponentWithProperties(EditOptionView, { optionMenu: this.patchedOptionMenu.patch(p), option, isNew: true, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
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

    get hasChanges() {
        return patchContainsChanges(this.patchProduct, this.product, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>

