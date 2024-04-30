<template>
    <SaveView :title="isNew ? 'Categorie toevoegen' : 'Categorie bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Zetelcategorie toevoegen
        </h1>
        <h1 v-else>
            Categorie bewerken
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
                <template #left>
                    <Checkbox v-model="adminOnly" />
                </template>

                <h3 class="style-title-list">
                    Enkel voor beheerders
                </h3>
                <p class="style-description-small">
                    Enkel een beheerder kan deze plaatsen selecteren bij het toevoegen van een bestelling.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr>
            <h2>
                Verwijder deze categorie
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
import { CenteredMessage, Checkbox, ErrorBox, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SeatingPlan, SeatingPlanCategory, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        Checkbox,
        STList,
        STListItem
    },
})
export default class EditSeatingPlanCategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        seatingPlan: SeatingPlan

    @Prop({ required: true })
        isNew!: boolean

    @Prop({ required: true })
        category: SeatingPlanCategory
    
    patchSeatingPlan: AutoEncoderPatchType<SeatingPlan> = SeatingPlan.patch({})

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<SeatingPlan>) => void);

    get patchedSeatingPlan() {
        return this.seatingPlan.patch(this.patchSeatingPlan)
    }

    get patchedCategory() {
        const c = this.patchedSeatingPlan.categories.find(c => c.id == this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    get name() {
        return this.patchedCategory.name
    }

    set name(name: string) {
        this.addCategoryPatch(SeatingPlanCategory.patch({ name }))
    }

    get price() {
        return this.patchedCategory.price
    }

    set price(price: number) {
        this.addCategoryPatch(SeatingPlanCategory.patch({ price }))
    }

    get adminOnly() {
        return this.patchedCategory.adminOnly
    }

    set adminOnly(adminOnly: boolean) {
        this.addCategoryPatch(SeatingPlanCategory.patch({ adminOnly }))
    }

    addCategoryPatch(patch: AutoEncoderPatchType<SeatingPlanCategory>) {
        const p = SeatingPlan.patch({ id: this.seatingPlan.id })
        p.categories.addPatch(patch.patch({ id: this.category.id }))
        this.addPatch(p)
    }

    addPatch(patch: AutoEncoderPatchType<SeatingPlan>) {
        this.patchSeatingPlan = this.patchSeatingPlan.patch(patch)
    }

    async save() {
        if (!await this.validator.validate()) {
            return
        }
        this.saveHandler(this.patchSeatingPlan)
        this.pop({ force: true })
    }

    get isSingle() {
        return this.patchedSeatingPlan.categories.length <= 1
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
            return
        }
        const p = SeatingPlan.patch({})
        p.categories.addDelete(this.category.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    get hasChanges() {
        return patchContainsChanges(this.patchSeatingPlan, this.seatingPlan, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>