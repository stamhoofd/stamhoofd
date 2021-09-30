<template>
    <div class="st-view record-category-edit-view">
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

            <div class="split-inputs">
                <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="Naam"
                        autocomplete=""
                    >
                </STInputBox>
            </div>

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Beschrijving"
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
import { CenteredMessage, ErrorBox, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { RecordCategory, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Spinner,
        STList,
    },
})
export default class EditRecordCategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    category!: RecordCategory

    @Prop({ required: true })
    isNew!: boolean

    patchCategory: AutoEncoderPatchType<RecordCategory> = RecordCategory.patch({ id: this.category.id })

    /**
     * Pass along the changes of the array (so we can also delete with the save handler)
     */
    @Prop({ required: true })
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => void;

    get patchedCategory() {
        return this.category.patch(this.patchCategory)
    }

    get title(): string {
        if (this.isNew) {
            return "Nieuwe categorie"
        }
        return "Categorie bewerken"
    }

    get name() {
        return this.patchedCategory.name
    }

    set name(name: string) {
        this.patchCategory = this.patchCategory.patch({ name })
    }

    get description() {
        return this.patchedCategory.description
    }

    set description(description: string) {
        this.patchCategory = this.patchCategory.patch({ description })
    }

    addPatch(patch: AutoEncoderPatchType<RecordCategory>) {
        this.patchCategory = this.patchCategory.patch(patch)
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()

        if (this.isNew) {
            arrayPatch.addPut(this.patchedCategory)
        } else {
            arrayPatch.addPatch(this.patchCategory)
        }

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen", "Alle kenmerken worden hierdoor ook verwijderd.")) {
            return
        }

        if (this.isNew) {
            // do nothing
            this.pop({ force: true })
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        arrayPatch.addDelete(this.category.id)

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchCategory, this.category, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>