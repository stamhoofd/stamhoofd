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
import { RecordChoice, RecordSettings, Version } from "@stamhoofd/structures"
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