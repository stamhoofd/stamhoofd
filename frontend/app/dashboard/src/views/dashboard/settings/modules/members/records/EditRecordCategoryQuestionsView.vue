<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <template slot="buttons">
            <button class="icon settings button gray" type="button" @click="editCategory()" />
        </template>
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p class="style-description">
            Lees <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>
        
        <p v-if="records.length === 0 && categories.length === 0" class="info-box">
            Deze vragenlijst is leeg en zal nog niet getoond worden.
        </p>

        <p v-if="patchedCategory.filter" class="info-box selectable with-icon" @click="editCategory()">
            {{ patchedCategory.filter.getString(filterDefinitionsForCategory()) }}
            <button type="button" class="button icon edit" />
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STList :draggable="true" :value="getDraggableRecords(patchedCategory)" group="records" @input="setDraggableRecords(patchedCategory, $event)">
            <RecordRow v-for="record in records" :key="record.id" :record="record" :category="patchedCategory" :root-categories="patchedRootCategories" :selectable="true" :settings="settings" @patch="addRootCategoriesPatch" />
        </STList>

        <p class="style-button-bar">
            <button class="button text" type="button" @click="addRecord()">
                <span class="icon add" />
                <span v-if="categories.length === 0">Vraag</span>
                <span v-else>Algemene vraag</span>
            </button>

            <button class="button text" type="button" @click="addCategory()">
                <span class="icon add" />
                <span>Categorie</span>
            </button>
        </p>

        <div v-for="c in categories" :key="c.id" class="container">
            <hr>
            <h2 class="style-with-button with-list">
                <div>
                    {{ c.name }}
                </div>
                <div>
                    <button class="icon add button gray" type="button" @click="addRecord(c)" />
                    <button class="icon settings button gray" type="button" @click="editCategory(c)" />
                </div>
            </h2>
            <p v-if="c.filter" class="info-box selectable with-icon" @click="editCategory(c)">
                {{ c.filter.getString(filterDefinitionsForCategory()) }}
                <button type="button" class="button icon edit" />
            </p>

            <p v-if="c.records.length === 0" class="info-box">
                Deze categorie bevat nog geen vragen.
            </p>
                
            <STList :draggable="true" :value="getDraggableRecords(c)" group="records" @input="setDraggableRecords(c, $event)">
                <RecordRow v-for="record in c.records" :key="record.id" :record="record" :category="c" :root-categories="patchedRootCategories" :settings="settings" :selectable="true" @patch="addRootCategoriesPatch" />
            </STList>
        </div>

        <div class="container">
            <hr>
            <h2>
                Acties
            </h2>

            <button class="button secundary" type="button" @click="showExample">
                <span class="icon eye" />
                <span>Voorbeeld</span>
            </button>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, FillRecordCategoryView, PropertyFilterInput, SaveView, STErrorsDefault, STInputBox, STList, Validator } from "@stamhoofd/components";
import { MemberDetailsWithGroups, PropertyFilter, RecordAnswer, RecordCategory, RecordEditorSettings, RecordSettings } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../../classes/OrganizationManager';
import EditRecordCategoryView from './EditRecordCategoryView.vue';
import EditRecordView from "./EditRecordView.vue";
import RecordRow from "./RecordRow.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        RecordRow,
        PropertyFilterInput
    },
})
export default class EditRecordCategoryQuestionsView<T> extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        categoryId!: string

    @Prop({ required: true })
        rootCategories!: RecordCategory[]

    //patchCategory: AutoEncoderPatchType<RecordCategory> = RecordCategory.patch({ id: this.category.id })
    patchRootCategories: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()

    /**
     * Pass along the changes of the array (so we can also delete with the save handler)
     */
    @Prop({ required: true })
        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => void;

    @Prop({ required: true })
        settings: RecordEditorSettings<T>

    filterDefinitionsForCategory() {
        const rootIndex = this.patchedRootCategories.findIndex(c => c.id === this.categoryId)
        if (rootIndex === -1) {
            return this.settings.filterDefinitions([])
        }
        const rootCategories = this.patchedRootCategories.slice(0, rootIndex + 1)
        return this.settings.filterDefinitions(rootCategories)
    }

    editCategory(category: RecordCategory = this.patchedCategory) {
        this.present({
            components: [
                new ComponentWithProperties(EditRecordCategoryView, {
                    category: category,
                    isNew: false,
                    parentCategory: category.id !== this.patchedCategory.id ? this.patchedCategory : null,
                    saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>, component: NavigationMixin) => {
                        if (category.id !== this.patchedCategory.id) {
                            this.addCategoriesPatch(patch)
                        } else {
                            this.patchRootCategories = this.patchRootCategories.patch(patch)
                        }
                        component.pop({ force: true })
                    },
                    filterDefinitions: this.filterDefinitionsForCategory()
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    get patchedRootCategories() {
        return this.patchRootCategories.applyTo(this.rootCategories)
    }

    get patchedCategory() {
        return this.patchedRootCategories.find(c => c.id === this.categoryId)!
    }

    get categories() {
        return this.patchedCategory.childCategories
    }

    get records() {
        return this.patchedCategory.records
    }

    get organization() {
        return OrganizationManager.organization
    }

    get title(): string {
        return this.patchedCategory.name
    }

    get name() {
        return this.patchedCategory.name
    }

    set name(name: string) {
        this.addPatchSimple({ name })
    }

    get filter() {
        return this.patchedCategory.filter ?? PropertyFilter.createDefault()
    }

    set filter(filter: PropertyFilter<MemberDetailsWithGroups> | null) {
        this.addPatchSimple({ filter })
    }

    get description() {
        return this.patchedCategory.description
    }

    set description(description: string) {
        this.addPatchSimple({ description })
    }

    addPatchSimple(patch: PartialWithoutMethods<AutoEncoderPatchType<RecordCategory>>) {
        this.addPatch(RecordCategory.patch(patch))
    }

    addPatch(patch: AutoEncoderPatchType<RecordCategory>) {
        patch.id = this.categoryId
        this.patchRootCategories.addPatch(patch)
    }

    addRootCategoriesPatch(patch: PatchableArrayAutoEncoder<RecordCategory>) {
        this.patchRootCategories.merge(patch)
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

    getDraggableRecords(category: RecordCategory) {
        return category.records;
    }

    setDraggableRecords(category: RecordCategory, records: RecordSettings[]) {
        if (category.id === this.categoryId) {
            const p = RecordCategory.patch({
                records: records as any
            })
            this.addPatch(p)
            return;
        }

        const p = RecordCategory.patch({
            id: category.id,
            records: records as any
        })

        const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        arr.addPatch(p)
        this.addCategoriesPatch(arr)
    }

    addCategory() {
        const category = RecordCategory.create({})

        this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(EditRecordCategoryView, {
                        category,
                        isNew: true,
                        parentCategory: this.patchedCategory,
                        filterDefinitions: this.filterDefinitionsForCategory(),
                        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>, component: NavigationMixin) => {
                            this.addCategoriesPatch(patch)
                            component.pop({ force: true })
                        }
                    })
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    addRecord(parent: RecordCategory = this.patchedCategory) {
        const record = RecordSettings.create({
            sensitive: false,
            required: true
        })

        this.present(new ComponentWithProperties(EditRecordView, {
            record,
            isNew: true,
            parentCategory: parent,
            settings: this.settings,
            saveHandler: (patch: PatchableArrayAutoEncoder<RecordSettings>) => {
                if (parent.id === this.categoryId) {
                    this.addRecordsPatch(patch)
                } else {
                    const p = RecordCategory.patch({
                        id: parent.id,
                        records: patch
                    })

                    const arr: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
                    arr.addPatch(p)
                    this.addCategoriesPatch(arr)
                }
            }
        }).setDisplayStyle("popup"))
    }

    async save() {
        const isValid = await this.validator.validate()
        if (!isValid) {
            return
        }

        this.saveHandler(this.patchRootCategories)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen", "Alle kenmerken worden hierdoor ook verwijderd.")) {
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        arrayPatch.addDelete(this.categoryId)

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    get hasChanges() {
        return this.patchRootCategories.changes.length > 0
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    showExample() {
        const displayedComponent = new ComponentWithProperties(FillRecordCategoryView, {
            category: this.patchedCategory,
            answers: [],
            dataPermission: true,
            filterDefinitions: this.filterDefinitionsForCategory(),
            markReviewed: false,
            hasNextStep: false,
            filterValueForAnswers: (answers: RecordAnswer[]) => {
                return this.settings.filterValueForAnswers(answers)
            },
            saveHandler: (_, component: NavigationMixin) => {
                component.dismiss({ force: true })
            }
        }).setDisplayStyle("popup");
        this.present(displayedComponent);
    }

    
}
</script>