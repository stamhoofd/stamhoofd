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
                <STInputBox title="Titel" error-fields="name" :error-box="errorBox">
                    <input
                        ref="firstInput"
                        v-model="name"
                        class="input"
                        type="text"
                        placeholder="Titel"
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
            <p class="style-description-small">
                De beschrijving staat onder de titel van de categorie
            </p>

            <hr>
            <h2 v-if="categories.length == 0">
                Kenmerken
            </h2>
            <h2 v-else>
                Subcategorieën
            </h2>
            <p>
                In elke categorie kan je kenmerken/vragen onderverdelen. Je kan er ook voor kiezen om een categorie nog eens onder te verdelen in categorieën, wat handig is als je heel wat informatie moet opvragen.
            </p>

            <STList v-if="categories.length > 0">
                <RecordCategoryRow v-for="c in categories" :key="c.id" :category="c" :categories="categories" :parent-category="patchedCategory" :selectable="true" @patch="addCategoriesPatch" />
            </STList>

            <STList v-if="records.length > 0">
                <RecordRow v-for="record in records" :key="record.id" :record="record" :records="records" :parent-category="patchedCategory" :selectable="true" @patch="addRecordsPatch" />
            </STList>

            <p v-if="categories.length == 0">
                <button class="button text" @click="addRecord">
                    <span class="icon add" />
                    <span>Nieuw kenmerk/vraag</span>
                </button>
            </p>

            <p v-if="!parentCategory">
                <button class="button text" @click="addCategory">
                    <span class="icon add" />
                    <span>Nieuwe subcategorie</span>
                </button>
            </p>

            <hr>
            <h2>Wanneer vragen?</h2>
            <p>Bepaal voor welke inschrijvingsgroepen deze kenmerken verzameld/gevraagd moeten worden. Zodra een lid in één van die groepen is ingeschreven, moet het deze gegevens ook nakijken als het voor een andere groep inschrijft.</p>

            <Checkbox>Alle groepen</Checkbox>
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { RecordCategory, RecordSettings, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditRecordView from "./EditRecordView.vue"
import RecordCategoryRow from "./RecordCategoryRow.vue"
import RecordRow from "./RecordRow.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Spinner,
        STList,
        RecordCategoryRow,
        RecordRow,
        Checkbox
    },
})
export default class EditRecordCategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    category!: RecordCategory

    @Prop({ required: false, default: null })
    parentCategory!: RecordCategory | null

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

    get categories() {
        return this.patchedCategory.childCategories
    }

    get records() {
        return this.patchedCategory.records
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
    
    addCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
        const p = RecordCategory.patch({
            childCategories: patch
        })
        this.addPatch(p)
    }

    addRecordsPatch(patch: PatchableArrayAutoEncoder<RecordSettings>) {
        const p = RecordCategory.patch({
            records: patch
        })
        this.addPatch(p)
    }

    addCategory() {
        const currentRecords = this.records
        const category = RecordCategory.create({
            records: currentRecords
        })

        this.present(new ComponentWithProperties(EditRecordCategoryView, {
            category,
            isNew: true,
            parentCategory: this.patchedCategory,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => {
                // Clear records that were added to the new category
                const p: PatchableArrayAutoEncoder<RecordSettings> = new PatchableArray()
                for (const record of currentRecords) {
                    p.addDelete(record.id)
                }
                this.addRecordsPatch(p)

                // Add category
                this.addCategoriesPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    addRecord() {
        const record = RecordSettings.create({})

        this.present(new ComponentWithProperties(EditRecordView, {
            record,
            isNew: true,
            parentCategory: this.patchedCategory,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                this.addRecordsPatch(patch)
            }
        }).setDisplayStyle("popup"))
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