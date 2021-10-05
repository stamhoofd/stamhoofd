<template>
    <div class="st-view choice-choice-edit-view">
        <STNavigationBar :title="title">
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
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
    
            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Optioneel"
                    autocomplete=""
                />
            </STInputBox>

            <hr>
            <h2>Waarschuwing</h2>
            <p>Soms wil je dat iets opvalt, dat kan je bereiken met waarschuwingen.</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" v-model="warningInverted" :value="null" name="warningInverted" />
                    <h3 class="style-title-list">
                        Geen waarschuwing
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" v-model="warningInverted" :value="false" name="warningInverted" />
                    <h3 class="style-title-list">
                        Waarschuwing als aangevinkt
                    </h3>
                </STListItem>

                <STListItem :selectable="true" element-name="label">
                    <Radio slot="left" v-model="warningInverted" :value="true" name="warningInverted" />
                    <h3 class="style-title-list">
                        Waarschuwing als niet aangevinkt
                    </h3>
                </STListItem>
            </STList>

            <STInputBox v-if="warningText !== null" title="Waarschuwingstekst" error-fields="label" :error-box="errorBox" class="max">
                <input
                    v-model="warningText"
                    class="input"
                    type="text"
                    placeholder="bv. 'Geen toestemming om foto's te maken'"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox v-if="warningType" class="max" title="Type">
                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="warningType" :value="RecordWarningType.Info" name="warningType" />
                        <h3 class="style-title-list">
                            Informatief
                        </h3>
                        <p class="style-description-small">
                            Grijze achtergrond. Voor minder belangrijke zaken
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="warningType" :value="RecordWarningType.Warning" name="warningType" />
                        <h3 class="style-title-list">
                            Waarschuwing
                        </h3>
                        <p class="style-description-small">
                            Gele achtergrond
                        </p>
                    </STListItem>

                    <STListItem :selectable="true" element-name="label">
                        <Radio slot="left" v-model="warningType" :value="RecordWarningType.Error" name="warningType" />
                        <h3 class="style-title-list">
                            Foutmelding
                        </h3>
                        <p class="style-description-small">
                            Voor zaken die echt heel belangrijk zijn. Probeer dit weinig te gebruiken, zet niet alles op 'foutmelding', anders valt het niet meer op.
                        </p>
                    </STListItem>
                </STList>
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
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, Radio,Spinner,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { RecordChoice, RecordSettings, RecordWarning, RecordWarningType, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Spinner,
        STList,
        STListItem,
        Radio,
        Checkbox
    },
})
export default class EditRecordChoiceView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    choice!: RecordChoice

    @Prop({ required: false, default: null })
    parentCategory!: RecordSettings | null

    @Prop({ required: true })
    isNew!: boolean

    patchChoice: AutoEncoderPatchType<RecordChoice> = RecordChoice.patch({ id: this.choice.id })

    @Prop({ required: true })
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordChoice>) => void;

    get RecordWarningType() {
        return RecordWarningType
    }

    get patchedChoice() {
        return this.choice.patch(this.patchChoice)
    }

    get title(): string {
        if (this.isNew) {
            return "Nieuwe keuze"
        }
        return "Keuzemogelijkheid bewerken"
    }

    get name() {
        return this.patchedChoice.name
    }

    set name(name: string) {
        this.patchChoice = this.patchChoice.patch({ name })
    }

    get description() {
        return this.patchedChoice.description
    }

    set description(description: string) {
        this.patchChoice = this.patchChoice.patch({ description })
    }

    get warningInverted() {
        return this.patchedChoice.warning?.inverted ?? null
    }

    set warningInverted(inverted: boolean | null) {
        if (inverted === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: null
             })
            return
        }
        if (this.warningInverted === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.create({
                    inverted
                })
             })
        } else {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.patch({
                    inverted
                })
             })
        }
    }

    get warningText() {
        return this.patchedChoice.warning?.text ?? null
    }

    set warningText(text: string | null) {
        if (text === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: null
             })
            return
        }
        if (this.warningText === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.create({
                    text
                })
             })
        } else {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.patch({
                    text
                })
             })
        }
    }

    get warningType() {
        return this.patchedChoice.warning?.type ?? null
    }

    set warningType(type: RecordWarningType | null) {
        if (type === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: null
             })
            return
        }
        if (this.warningType === null) {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.create({
                    type
                })
             })
        } else {
            this.patchChoice = this.patchChoice.patch({ 
                warning: RecordWarning.patch({
                    type
                })
             })
        }
    }

    addPatch(patch: AutoEncoderPatchType<RecordChoice>) {
        this.patchChoice = this.patchChoice.patch(patch)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()

        if (this.isNew) {
            arrayPatch.addPut(this.patchedChoice)
        } else {
            arrayPatch.addPatch(this.patchChoice)
        }

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze keuzemogelijkheid wilt verwijderen?", "Verwijderen")) {
            return
        }

        if (this.isNew) {
            // do nothing
            this.pop({ force: true })
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordChoice> = new PatchableArray()
        arrayPatch.addDelete(this.choice.id)

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchChoice, this.choice, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>