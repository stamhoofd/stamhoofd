<template>
    <div class="st-view option-edit-view">
        <STNavigationBar :title="isNew ? 'Keuze toevoegen' : name+' bewerken'">
            <template slot="right">
                <button class="button text" v-if="!isNew && !isSingle" @click="deleteMe">
                    <span class="icon trash"/>
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Keuze toevoegen
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
                    placeholder="Naam van deze keuze"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Meer of minkost" error-fields="price" :error-box="errorBox">
                <PriceInput v-model="price" placeholder="+ 0 euro" />
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
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Validator, CenteredMessage, PriceInput } from "@stamhoofd/components";
import { Category, Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Option, OptionMenu, Organization, PrivateWebshop, Product, ProductPrice, Version, WaitingListType, Webshop } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        STList
    },
})
export default class EditOptionView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    optionMenu: OptionMenu

    @Prop({ required: true })
    option: Option
    
    patchOptionMenu: AutoEncoderPatchType<OptionMenu> = OptionMenu.patch({})

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<OptionMenu>) => void);

    get patchedOptionMenu() {
        return this.optionMenu.patch(this.patchOptionMenu)
    }

    get patchedOption() {
        const c = this.patchedOptionMenu.options.find(c => c.id == this.option.id)
        if (c) {
            return c
        }
        return this.option
    }

    get isNew() {
        return this.option.name.length == 0
    }

    get name() {
        return this.patchedOption.name
    }

    set name(name: string) {
        this.addOptionPatch(Option.patch({ name }))
    }

    get price() {
        return this.patchedOption.price
    }

    set price(price: number) {
        this.addOptionPatch(Option.patch({ price }))
    }

    addOptionPatch(patch: AutoEncoderPatchType<Option>) {
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPatch(Option.patch(Object.assign({}, patch, { id: this.option.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<OptionMenu>) {
        this.patchOptionMenu = this.patchOptionMenu.patch(patch)
    }

    save() {
        this.saveHandler(this.patchOptionMenu)
        this.pop({ force: true })
    }

    get isSingle() {
        return this.patchedOptionMenu.options.length <= 1
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze keuze wilt verwijderen?", "Verwijderen")) {
            return
        }
        const p = OptionMenu.patch({})
        p.options.addDelete(this.option.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchOptionMenu, this.optionMenu, { version: Version })
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


</style>
