<template>
    <SaveView :title="isNew ? 'Keuze toevoegen' : name+' bewerken'" :disabled="!hasChanges && !isNew" @save="save">
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
            <PriceInput v-model="price" placeholder="+ 0 euro" :min="null" />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <Checkbox #left v-model="useStock" />

                <h3 class="style-title-list">
                    Beperk het beschikbare aantal stuks (waarvan nu {{ usedStock }} verkocht of gereserveerd)
                </h3>

                <p v-if="useStock" class="style-description-small">
                    Geannuleerde en verwijderde bestellingen worden niet meegerekend.
                </p>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errorBox">
                        <NumberInput v-model="stock" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr>
            <h2>
                Verwijder deze keuze
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, NumberInput, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { Option, OptionMenu, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        NumberInput,
        STList,
        STListItem,
        Checkbox
    },
})
export default class EditOptionView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        optionMenu: OptionMenu

    @Prop({ required: true })
        isNew!: boolean

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

    get useStock() {
        return this.patchedOption.stock !== null
    }

    set useStock(useStock: boolean) {
        this.addOptionPatch(Option.patch({ stock: useStock ? (this.patchedOption.stock ?? this.patchedOption.stock ?? (this.patchedOption.usedStock || 10)) : null }))
    }

    get stock() {
        return this.patchedOption.stock
    }

    set stock(stock: number | null) {
        this.addOptionPatch(Option.patch({ stock }))
    }

    get usedStock() {
        return this.patchedOption.usedStock
    }

    addOptionPatch(patch: AutoEncoderPatchType<Option>) {
        const p = OptionMenu.patch({ id: this.optionMenu.id })
        p.options.addPatch(Option.patch(Object.assign({}, patch, { id: this.option.id })))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<OptionMenu>) {
        this.patchOptionMenu = this.patchOptionMenu.patch(patch)
    }

    async save() {
        if (!await this.validator.validate()) {
            return
        }
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

    get hasChanges() {
        return patchContainsChanges(this.patchOptionMenu, this.optionMenu, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>