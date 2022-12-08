<template>
    <SaveView :loading="false" :title="title" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
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
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, PropertyFilterInput, SaveView, STErrorsDefault, STInputBox, STList, Validator } from "@stamhoofd/components";
import { FilterDefinition, MemberDetailsWithGroups, PropertyFilter, RecordCategory, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../../../classes/OrganizationManager';

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
    saveHandler: (patch: PatchableArrayAutoEncoder<RecordCategory>) => void;

    @Prop({ required: true })
    filterDefinitions!: FilterDefinition[]

    get patchedCategory() {
        return this.category.patch(this.patchCategory)
    }

    get organization() {
        return OrganizationManager.organization
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

        const arrayPatch: PatchableArrayAutoEncoder<RecordCategory> = new PatchableArray()

        if (this.isNew) {
            arrayPatch.addPut(this.patchedCategory)
        } else {
            arrayPatch.addPatch(this.patchCategory)
        }

        this.saveHandler(arrayPatch)
        this.pop({ force: true })
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