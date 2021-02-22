<template>
    <div class="st-view">
        <STNavigationBar :title="isNew ? 'Categorie toevoegen' : name+' bewerken'">
            <template slot="right">
                <button class="button text" v-if="!isNew" @click="deleteMe">
                    <span class="icon trash"/>
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Categorie toevoegen
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
                    placeholder="Naam van deze categorie"
                    autocomplete=""
                >
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
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Validator, CenteredMessage } from "@stamhoofd/components";
import { GroupCategory, Organization, Version, GroupCategorySettings, OrganizationMetaData } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList
    },
})
export default class EditCategoryView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    category: GroupCategory

    @Prop({ required: true })
    organization: Organization
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<Organization>) => void);

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedCategory() {
        const c = this.patchedOrganization.meta.categories.find(c => c.id == this.category.id)
        if (c) {
            return c
        }
        return this.category
    }

    get isNew() {
        return this.category.settings.name.length == 0
    }

    get name() {
        return this.patchedCategory.settings.name
    }

    set name(name: string) {
        this.addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    name
                })
            })
        )
    }

    addCategoryPatch(patch: AutoEncoderPatchType<GroupCategory>) {
        const meta = OrganizationMetaData.patch({})
        meta.categories.addPatch(GroupCategory.patch(Object.assign({}, patch, { id: this.category.id })))

        this.addPatch(Organization.patch({
            meta
        }))
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    save() {
        this.saveHandler(this.patchOrganization)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
            return
        }
        const meta = OrganizationMetaData.patch({})
        meta.categories.addDelete(this.category.id)
        const p = Organization.patch({
            meta
        })
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        console.log("should navigate away")
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>
