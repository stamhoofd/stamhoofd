<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button v-if="!isNew && !isRoot && enableActivities" class="button text" @click="deleteMe">
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
            <p v-if="isRoot && enableActivities">
                Voeg hier categorieën toe waarin je jouw inschrijvingsgroepen kan onderverdelen. Zo kan je bijvoorbeeld een categorie maken voor al je danslessen, leeftijdsgroepen, activiteiten, weekends, kampen, ...
                Jouw leden krijgen dan alle mogelijke (openbare) inschrijvingsgroepen te zien op jouw inschrijvingspagina.
            </p>
          
            <STErrorsDefault :error-box="errorBox" />

            <template v-if="!isRoot">
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

                <template v-if="enableActivities">
                    <Checkbox v-model="limitRegistrations" v-if="categories.length == 0">
                        Een lid kan maar in één groep inschrijven
                    </Checkbox>

                    <Checkbox v-model="isHidden">
                        Verberg deze categorie voor leden
                    </Checkbox>
                </template>
            </template>

            <template v-if="categories.length > 0 && enableActivities">
                <hr>
                <h2>Categorieën</h2>
                <STList>
                    <GroupCategoryRow v-for="category in categories" :key="category.id" :category="category" :organization="patchedOrganization" @patch="addPatch" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)" />
                </STList>
            </template>

            <template v-else>
                <hr>
                <h2>Inschrijvingsgroepen</h2>
                <STList>
                    <GroupRow v-for="group in groups" :key="group.id" :group="group" :organization="patchedOrganization" @patch="addPatch" @move-up="moveGroupUp(group)" @move-down="moveGroupDown(group)" />
                </STList>
            </template>

            <p v-if="categories.length == 0">
                <button class="button text" @click="createGroup">
                    <span class="icon add" />
                    <span>Nieuwe groep toevoegen</span>
                </button>
            </p>
            <p v-if="enableActivities">
                <button class="button text" @click="createCategory">
                    <span class="icon add" />
                    <span>Nieuwe categorie toevoegen</span>
                </button>
            </p>

            <div v-if="!isRoot && enableActivities" class="container">
                <hr>
                <h2>Wie kan groepen maken in deze categorie?</h2>
                <p>Deze beheerders kunnen zelf bijvoorbeeld een nieuwe activiteit, cursus of workshop toevoegen in deze categorie. Beheerders zien enkel de groepen de ze zelf hebben aangemaakt of waar ze toegang tot hebben gekregen. Je kan beheerdersgroepen bewerken bij je instellingen.</p>
    
                <STList v-if="roles.length > 0">
                    <STListItem>
                        <Checkbox slot="left" :checked="true" :disabled="true" />
                        Hoofdbeheerders
                    </STListItem>
                    <STListItem v-for="role in roles" :key="role.id" element-name="label" :selectable="true" class="right-description">
                        <Checkbox slot="left" :checked="getCreateRole(role)" @change="setCreateRole(role, $event)" />
                        {{ role.name }}
                    </STListItem>
                </STList>

                <p v-else-if="fullAccess" class="info-box">
                    Je hebt nog geen beheerdersgroepen aangemaakt. Maak beheerdersgroepen aan via instellingen > beheerders
                </p>
            </div>
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
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem,STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryPermissions, GroupCategorySettings, GroupGenderType,GroupSettings, Organization, OrganizationGenderType, OrganizationMetaData, OrganizationPrivateMetaData, PermissionRole, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditCategoryView from './EditCategoryView.vue';
import EditGroupView from './EditGroupView.vue';
import GroupCategoryRow from "./GroupCategoryRow.vue"
import GroupRow from "./GroupRow.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        STList,
        GroupRow,
        GroupCategoryRow,
        LoadingButton,
        BackButton,
        Checkbox,
        STListItem
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

    get isNew() {
        return this.category.settings.name.length == 0
    }

    get isRoot() {
        return this.category.id === this.organization.meta.rootCategoryId
    }

    get fullAccess() {
        return SessionManager.currentSession!.user!.permissions!.hasFullAccess()
    }

    get roles() {
        return this.patchedOrganization.privateMeta?.roles ?? []
    }

    getCreateRole(role: PermissionRole) {
        return !!this.patchedCategory.settings.permissions.create.find(r => r.id === role.id)
    }

    setCreateRole(role: PermissionRole, enable: boolean) {
        const p = GroupCategoryPermissions.patch({})

        if (enable) {
            if (this.getCreateRole(role)) {
                return
            }
            p.create.addPut(role)
        } else {
            p.create.addDelete(role.id)
        }
        this.addPermissionsPatch(p)
    }

    get title() {
        return this.isRoot ? 'Inschrijvingsgroepen bewerken' : (this.isNew ? "Nieuwe categorie" : this.name)
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

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
                prices: this.organization.meta.defaultPrices,
                genderType: this.organization.meta.genderType == OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale
            })
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
        
        this.present(new ComponentWithProperties(EditGroupView, { 
            group, 
            organization: this.patchedOrganization.patch(p), 
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(p.patch(patch))
            }
        }).setDisplayStyle("popup"))
    }

    createCategory() {
        const category = GroupCategory.create({})
        const meta = OrganizationMetaData.patch({})
        meta.categories.addPut(category)

        const me = GroupCategory.patch({ id: this.category.id })
        me.categoryIds.addPut(category.id)
        meta.categories.addPatch(me)

        const p = Organization.patch({
            id: this.organization.id,
            meta
        })
        
        this.show(new ComponentWithProperties(EditCategoryGroupsView, { 
            category: category, 
            organization: this.patchedOrganization.patch(p), 
            saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(p.patch(patch))
            }
        }))
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
