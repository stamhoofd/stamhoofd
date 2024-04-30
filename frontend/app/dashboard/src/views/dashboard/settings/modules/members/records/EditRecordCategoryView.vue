<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p class="style-description">
            Lees <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/vragenlijsten-instellen/'" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

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
                    enterkeyhint="next"
                >
            </STInputBox>
        </div>

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
        <h2>Filters</h2>
        <p v-if="!parentCategory">
            Je kan kiezen wanneer deze vragen van toepassing zijn, en of deze stap overgeslagen kan worden.
        </p>
        <p v-else>
            Je kan kiezen wanneer deze vragen van toepassing zijn.
        </p>

        <PropertyFilterInput v-model="filter" :allow-optional="!parentCategory" :organization="organization" :definitions="filterDefinitions" />

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Acties
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, PropertyFilterInput, SaveView, STErrorsDefault, STInputBox, STList, Validator } from "@stamhoofd/components";
import { FilterDefinition, MemberDetailsWithGroups, PropertyFilter, RecordCategory, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";



@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        PropertyFilterInput
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
        saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>, component: NavigationMixin) => void;

    @Prop({ required: true })
        filterDefinitions!: FilterDefinition[]

    get patchedCategory() {
        return this.category.patch(this.patchCategory)
    }

    get organization() {
        return this.$organization
    }

    get title(): string {
        if (!this.parentCategory) {
            if (this.isNew) {
                return "Nieuwe vragenlijst"
            }
            return "Vragenlijst bewerken"
        }

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

    get filter() {
        return this.patchedCategory.filter ?? PropertyFilter.createDefault()
    }

    set filter(filter: PropertyFilter<MemberDetailsWithGroups> | null) {
        this.patchCategory = this.patchCategory.patch({ filter })
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

        if (this.name.trim().length === 0) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: 'invalid_field',
                field: 'name',
                message: 'Gelieve een titel voor je vragenlijst in te vullen'
            }))
            return;
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()

        if (this.isNew) {
            arrayPatch.addPut(this.patchedCategory)
        } else {
            arrayPatch.addPatch(this.patchCategory)
        }

        this.saveHandler(arrayPatch, this)
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
            return
        }

        const arrayPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()
        arrayPatch.addDelete(this.category.id)
        this.saveHandler(arrayPatch, this)
    }

    cancel() {
        this.pop()
    }

    get hasChanges() {
        return patchContainsChanges(this.patchCategory, this.category, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>