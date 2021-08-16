<template>
    <div class="st-view webshop-field-edit-view">
        <STNavigationBar :title="isNew ? 'Vraag toevoegen' : 'Vraag bewerken'">
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
                Vraag toevoegen
            </h1>
            <h1 v-else>
                Vraag bewerken
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

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Optioneel"
                    autocomplete=""
                />
            </STInputBox>
            <p class="style-description-small">
                Deze tekst is zichtbaar in het klein onder het tekstvak (zoals deze tekst).
            </p>

            <Checkbox v-model="required">
                Verplicht invullen
            </Checkbox>

            <template v-if="required">
                <STInputBox title="Placeholder*" error-fields="placeholder" :error-box="errorBox">
                    <input
                        v-model="placeholder"
                        class="input"
                        type="text"
                        placeholder="Tekst in lege velden"
                        autocomplete=""
                    >
                </STInputBox>
                <p class="style-description-small">
                    * Dit is de tekst die zichtbaar is in het veld als het leeg is. Bv. 'Vul hier jouw naam in'. Hou het kort.
                </p>
            </template>
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
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, PriceInput,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { Version, WebshopField } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        STList,
        Checkbox
    },
})
export default class EditWebshopFieldView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    field: WebshopField

    @Prop({ required: true })
    isNew!: boolean
    
    patchField: AutoEncoderPatchType<WebshopField> = WebshopField.patch({})

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: PatchableArrayAutoEncoder<WebshopField>) => void);

    get patchedField() {
        return this.field.patch(this.patchField)
    }


    get name() {
        return this.patchedField.name
    }

    set name(name: string) {
        this.addPatch(WebshopField.patch({ name }))
    }

    get required(){
        return this.patchedField.required
    }

    set required(required: boolean) {
        this.addPatch(WebshopField.patch({ required }))
    }

    get description() {
        return this.patchedField.description
    }

    set description(description: string) {
        this.addPatch(WebshopField.patch({ description }))
    }

    get placeholder() {
        return this.patchedField.placeholder
    }

    set placeholder(placeholder: string) {
        this.addPatch(WebshopField.patch({ placeholder }))
    }

    addPatch(patch: AutoEncoderPatchType<WebshopField>) {
        this.patchField = this.patchField.patch(patch)
    }

    async save() {
        if (!await this.validator.validate()) {
            return
        }
        const p: PatchableArrayAutoEncoder<WebshopField>= new PatchableArray()
        p.addPatch(WebshopField.patch(Object.assign({}, this.patchField, { id: this.field.id })))
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze vraag wilt verwijderen?", "Verwijderen")) {
            return
        }
        const p: PatchableArrayAutoEncoder<WebshopField>= new PatchableArray()
        p.addDelete(this.field.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchField, this.field, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>