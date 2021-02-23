<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template slot="right">
                <button class="button text" v-if="!isNew" @click="editMe">
                    <span class="icon settings"/>
                    <span>Wijzigen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                {{ title }}
            </h1>
            <p v-if="isRoot">
                Voeg hier categorieën toe waarin je jouw inschrijvingsgroepen kan onderverdelen. Zo kan je bijvoorbeeld een categorie maken voor al je danslessen, leeftijdsgroepen, activiteiten, weekends, kampen, ...
                Jouw leden krijgen dan alle mogelijke (openbare) inschrijvingsgroepen te zien op jouw inschrijvingspagina.
            </p>
          
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="categories.length > 0">
                <h2>Categorieën</h2>
                <STList>
                    <GroupCategoryRow v-for="category in categories" :key="category.id" :category="category" :organization="patchedOrganization" @patch="addPatch" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)"/>
                </STList>
            </template>

            <template v-else-if="groups.length > 0">
                <h2>Inschrijvingsgroepen</h2>
                <STList>
                    <GroupRow v-for="group in groups" :key="group.id" :group="group" :organization="patchedOrganization" @patch="addPatch" @move-up="moveGroupUp(group)" @move-down="moveGroupDown(group)"/>
                </STList>
            </template>
            
            
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Validator, CenteredMessage, LoadingButton } from "@stamhoofd/components";
import { GroupCategory, Organization, Version, GroupCategorySettings, OrganizationMetaData, Group } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import GroupRow from "./GroupRow.vue"
import GroupCategoryRow from "./GroupCategoryRow.vue"
import EditCategoryView from './EditCategoryView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        GroupRow,
        GroupCategoryRow,
        LoadingButton
    },
})
export default class EditCategoryGroupsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
    category: GroupCategory

    @Prop({ required: true })
    organization: Organization
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<Organization>) => Promise<void>);

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

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId
    }

    get title() {
        return this.isRoot ? 'Inschrijvingsgroepen bewerken' : this.name+''
    }

    get name() {
        return this.patchedCategory.settings.name
    }

    get groups() {
        return this.patchedCategory.groupIds.flatMap(id => {
            const group = this.patchedOrganization.groups.find(g => g.id === id)
            if (group) {
                return [group]
            }
            return []
        })
    }

    get categories() {
        return this.patchedCategory.categoryIds.flatMap(id => {
            const category = this.patchedOrganization.meta.categories.find(c => c.id === id)
            if (category) {
                return [category]
            }
            return []
        })
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

    moveCategoryUp(category: GroupCategory) {
        const index = this.patchedCategory.categoryIds.findIndex(id => category.id === id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = GroupCategory.patch({})
        p.categoryIds.addMove(category.id, this.patchedCategory.categoryIds[moveTo] ?? null)
        this.addCategoryPatch(p)
    }

    moveCategoryDown(category: GroupCategory) {
        const index = this.patchedCategory.categoryIds.findIndex(id => category.id === id)
        if (index == -1 || index >= this.patchedCategory.categoryIds.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = GroupCategory.patch({})
        p.categoryIds.addMove(category.id, this.patchedCategory.categoryIds[moveTo])
        this.addCategoryPatch(p)
    }

    moveGroupUp(group: Group) {
        const index = this.patchedCategory.groupIds.findIndex(id => group.id === id)
        if (index == -1 || index == 0) {
            return;
        }

        const moveTo = index - 2
        const p = GroupCategory.patch({})
        p.groupIds.addMove(group.id, this.patchedCategory.groupIds[moveTo] ?? null)
        this.addCategoryPatch(p)
    }

    moveGroupDown(group: Group) {
        const index = this.patchedCategory.groupIds.findIndex(id => group.id === id)
        if (index == -1 || index >= this.patchedCategory.groupIds.length - 1) {
            return;
        }

        const moveTo = index + 1
        const p = GroupCategory.patch({})
        p.groupIds.addMove(group.id, this.patchedCategory.groupIds[moveTo])
        this.addCategoryPatch(p)
    }

    async save() {
        this.saving = true
        try {
            await this.saveHandler(this.patchOrganization)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    editMe() {
        this.present(new ComponentWithProperties(EditCategoryView, { 
            category: this.patchedCategory, 
            organization: this.patchedOrganization, 
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
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
