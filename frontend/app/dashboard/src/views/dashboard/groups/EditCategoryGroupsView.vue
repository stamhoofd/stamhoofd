<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>
            
        <p v-if="isRoot && enableActivities">
            Voeg hier alle groepen toe waarin je jouw leden wilt onderverdelen. Als je geen onderverdeling wilt, kan je gewoon één groep toevoegen. Leden kunnen dan inschrijven voor één of meerdere inschrijvingsgroepen. Je kan ook categorieën toevoegen: een categorie is puur voor de structuur, zo kan je bijvoorbeeld een categorie maken voor al je danslessen, leeftijdsgroepen, activiteiten, weekends, kampen, ...
        </p>
          
        <STErrorsDefault :error-box="errorBox" />

        <STInputBox v-if="!isRoot" title="Naam" error-fields="name" :error-box="errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze categorie"
                autocomplete=""
            >
        </STInputBox>

        <template v-if="enableActivities">
            <Checkbox v-if="categories.length == 0" v-model="limitRegistrations">
                Een lid kan maar in één groep inschrijven
            </Checkbox>

            <Checkbox v-if="!isRoot" v-model="isHidden">
                Toon deze categorie enkel voor beheerders
            </Checkbox>

            <p v-if="!isRoot && !isHidden && !isPublic" class="warning-box">
                Een bovenliggende categorie is enkel zichtbaar voor beheerders, dus deze categorie is bijgevolg ook enkel zichtbaar voor beheerders.
            </p>
        </template>

        <template v-if="categories.length > 0">
            <hr>
            <h2>Categorieën</h2>
            <STList v-model="draggableCategories" :draggable="true">
                <GroupCategoryRow v-for="category in categories" :key="category.id" :category="category" :organization="patchedOrganization" @patch="addPatch" @delete="deleteCategory(category)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)" />
            </STList>
        </template>

        <template v-if="groups.length > 0 || categories.length == 0">
            <hr>
            <h2>Groepen</h2>
            <STList v-model="draggableGroups" :draggable="true">
                <GroupRow v-for="group in groups" :key="group.id" :group="group" :organization="patchedOrganization" @patch="addPatch" @delete="deleteGroup(group)" @move-up="moveGroupUp(group)" @move-down="moveGroupDown(group)" />
            </STList>
        </template>

        <p v-if="categories.length == 0">
            <button class="button text" type="button" @click="createGroup">
                <span class="icon add" />
                <span>Nieuwe groep</span>
            </button>
        </p>
        <p v-if="enableActivities">
            <button class="button text" type="button" @click="createCategory">
                <span class="icon add" />
                <span v-if="groups.length == 0">Nieuwe categorie</span>
                <span v-else>Opdelen in categorieën</span>
            </button>
        </p>

        <div v-if="!isRoot && enableActivities" class="container">
            <hr>
            <h2>Toegangsbeheer</h2>
            <p>Je kan toegang tot leden instellen per groep (instellingen van groep zelf) of per categorie (hieronder). Kies ook welke beheerders zelf een nieuwe groep (bv. activiteit, cursus of workshop) kunnen toevoegen in deze categorie. Je kan functies bewerken bij je instellingen.</p>
    
            <STList v-if="roles.length > 0">
                <STListItem>
                    <Checkbox slot="left" :checked="true" :disabled="true" />
                    Hoofdbeheerders
                </STListItem>
                <GroupCategoryPermissionRow v-for="role in roles" :key="role.id" type="role" :role="role" :category="patchedCategory" :organization="patchedOrganization" @patch="addCategoryPatch" />
            </STList>

            <p v-else-if="fullAccess" class="info-box">
                Je hebt nog geen functies aangemaakt. Maak functies aan via instellingen > beheerders
            </p>
        </div>

        <div v-if="isRoot && fullAccess" class="container">
            <hr>
            <h2>Prullenmand inschrijvingsgroepen</h2>
            <p>Per ongeluk een inschrijvingsgroep verwijderd? Hier haal je de inschrijvingsgroep en daarbij horende leden terug.</p>
            <button type="button" class="button text" @click="openGroupTrash">
                <span class="icon trash" /><span>Open prullenmand</span>
            </button>
        </div>

        <div v-if="!isNew && !isRoot && enableActivities" class="container">
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryPermissions, GroupCategorySettings, GroupGenderType, GroupPrivateSettings, GroupSettings, Organization, OrganizationGenderType, OrganizationMetaData, PermissionRole, Version } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import GroupCategoryPermissionRow from '../admins/GroupCategoryPermissionRow.vue';
import EditGroupGeneralView from './edit/EditGroupGeneralView.vue';
import GroupCategoryRow from "./GroupCategoryRow.vue";
import GroupRow from "./GroupRow.vue";
import GroupTrashView from './GroupTrashView.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        GroupRow,
        GroupCategoryRow,
        LoadingButton,
        BackButton,
        Checkbox,
        STListItem,
        GroupCategoryPermissionRow
    },
})
export default class EditCategoryGroupsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
        category: GroupCategory

    @Prop({ default: false })
        isNew!: boolean

    @Prop({ required: true })
        organization: Organization
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<Organization>) => Promise<void>);

    get isPublic() {
        return this.patchedCategory.isPublic(this.patchedOrganization.availableCategories)
    }

    get enableActivities() {
        return this.organization.meta.modules.useActivities
    }

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

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess(this.patchedOrganization.privateMeta?.roles ?? [])
    }

    get roles() {
        return this.patchedOrganization.privateMeta?.roles ?? []
    }

    get title() {
        return this.isRoot ? 'Inschrijvingsgroepen'+(this.enableActivities ? " en activiteiten" : "") : (this.isNew ? "Nieuwe categorie" : this.name)
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

    get limitRegistrations() {
        return this.patchedCategory.settings.maximumRegistrations !== null
    }

    set limitRegistrations(limitRegistrations: boolean) {
        this.addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    maximumRegistrations: limitRegistrations ? 1 : null
                })
            })
        )
    }

    get isHidden() {
        return !this.patchedCategory.settings.public
    }

    set isHidden(isHidden: boolean) {
        this.addCategoryPatch(
            GroupCategory.patch({ 
                settings: GroupCategorySettings.patch({
                    public: !isHidden
                })
            })
        )
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

    addPermissionsPatch(patch: AutoEncoderPatchType<GroupCategoryPermissions>) {
        this.addCategoryPatch(GroupCategory.patch({
            settings: GroupCategorySettings.patch({
                permissions: GroupCategoryPermissions.patch(patch)
            })
        }))
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    get draggableCategories() {
        return this.categories;
    }

    set draggableCategories(categories) {
        if (categories.length != this.categories.length) {
            return;
        }

        const patch = GroupCategory.patch({})
        for (const p of categories.slice().reverse()) {
            patch.categoryIds.addMove(p.id, null)
        }
        this.addCategoryPatch(patch)
    }

    get draggableGroups() {
        return this.groups;
    }

    set draggableGroups(groups) {
        if (groups.length != this.groups.length) {
            return;
        }

        const patch = GroupCategory.patch({})
        for (const p of groups.slice().reverse()) {
            patch.groupIds.addMove(p.id, null)
        }
        this.addCategoryPatch(patch)
    }

    deleteCategory(category: GroupCategory) {
        const p = GroupCategory.patch({})
        p.categoryIds.addDelete(category.id)
        this.addCategoryPatch(p)
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

    deleteGroup(group: Group) {
        const p = GroupCategory.patch({})
        p.groupIds.addDelete(group.id)
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

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                prices: [],
                genderType: this.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
            }),
            privateSettings: GroupPrivateSettings.create({})
        })
        const meta = OrganizationMetaData.patch({})

        const me = GroupCategory.patch({ id: this.category.id })
        me.groupIds.addPut(group.id)
        meta.categories.addPatch(me)

        const p = Organization.patch({
            id: this.organization.id,
            meta
        })

        p.groups.addPut(group)
        
        this.present(new ComponentWithProperties(EditGroupGeneralView, { 
            group, 
            organization: this.patchedOrganization.patch(p), 
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    createCategory() {
        const category = GroupCategory.create({})
        category.groupIds = this.patchedCategory.categoryIds.length == 0 ? this.patchedCategory.groupIds : []
        
        const meta = OrganizationMetaData.patch({})
        meta.categories.addPut(category)

        const me = GroupCategory.patch({ 
            id: this.category.id,
            groupIds: [] as any
        })

        me.categoryIds.addPut(category.id)
        meta.categories.addPatch(me)

        const p = Organization.patch({
            id: this.organization.id,
            meta
        })
        
        this.present(new ComponentWithProperties(EditCategoryGroupsView, { 
            category: category, 
            organization: this.patchedOrganization.patch(p), 
            isNew: true,
            saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    openGroupTrash() {
        this.show({
            components: [
                new ComponentWithProperties(GroupTrashView, { }).setDisplayStyle("popup")
            ],
            replace: 1
        })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm(this.groups.length ? "Ben je zeker dat je deze categorie en groepen wilt verwijderen?" : "Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
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

    get hasChanges() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>
