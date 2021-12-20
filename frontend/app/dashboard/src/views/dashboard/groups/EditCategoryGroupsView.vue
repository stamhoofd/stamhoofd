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
            <h2>Groepen</h2>
            <STList>
                <GroupRow v-for="group in groups" :key="group.id" :group="group" :organization="patchedOrganization" @patch="addPatch" @move-up="moveGroupUp(group)" @move-down="moveGroupDown(group)" />
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

        <div class="container">
            <hr>
            <h2>Start nieuwe inschrijvingsperiode</h2>
            <p>Op het einde van een werkjaar, semester, kwartaal... (kies je volledig zelf) kan je leden automatisch verplaatsen naar een vorige inschrijvingsperiode, zodat ze opnieuw moeten inschrijven en betalen om hun inschrijving te verlengen.</p>
            <button type="button" class="button text" @click.left.exact="startNewRegistrationPeriod(false)" @click.alt.exact="startNewRegistrationPeriod(true)">
                <span class="icon undo" /><span>Start nieuwe inschrijvingsperiode...</span>
            </button>
        </div>

        <div v-if="!isRoot && enableActivities" class="container">
            <hr>
            <h2>Wie kan groepen maken in deze categorie?</h2>
            <p>Deze beheerders kunnen zelf bijvoorbeeld een nieuwe groep (bv. activiteit, cursus of workshop) toevoegen in deze categorie. Beheerders zien enkel de groepen de ze zelf hebben aangemaakt of waar ze toegang tot hebben gekregen. Je kan beheerdersgroepen bewerken bij je instellingen.</p>
    
            <STList v-if="roles.length > 0">
                <STListItem>
                    <Checkbox slot="left" :checked="true" :disabled="true" />
                    Hoofdbeheerders
                </STListItem>
                <STListItem v-for="role in roles" :key="role.id" element-name="label" :selectable="true" class="right-description">
                    <Checkbox slot="left" :checked="getCreateRole(role)" @change="setCreateRole(role, $event)" />
                    {{ role.name }}
                </STListItem>
            </STList>

            <p v-else-if="fullAccess" class="info-box">
                Je hebt nog geen beheerdersgroepen aangemaakt. Maak beheerdersgroepen aan via instellingen > beheerders
            </p>
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
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, SaveView, STErrorsDefault,STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryPermissions, GroupCategorySettings, GroupCategoryTree, GroupGenderType,GroupPrivateSettings,GroupSettings, Organization, OrganizationGenderType, OrganizationMetaData, OrganizationPrivateMetaData, PermissionRole, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import EditGroupView from './EditGroupView.vue';
import EndRegistrationPeriodView from './EndRegistrationPeriodView.vue';
import GroupCategoryRow from "./GroupCategoryRow.vue"
import GroupRow from "./GroupRow.vue"

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
        STListItem
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

    createGroup() {
        const group = Group.create({
            settings: GroupSettings.create({
                name: "",
                startDate: this.organization.meta.defaultStartDate,
                endDate: this.organization.meta.defaultEndDate,
                registrationStartDate: this.organization.meta.defaultStartDate,
                registrationEndDate: this.organization.meta.defaultEndDate,
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
        category.groupIds = this.category.categoryIds.length == 0 ? this.category.groupIds : []
        
        const meta = OrganizationMetaData.patch({})
        meta.categories.addPut(category)

        const me = GroupCategory.patch({ 
            id: this.category.id,
        })

        // Delete all groups in this category
        for (const id of this.category.groupIds) {
            me.groupIds.addDelete(id)
        }

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

    get hasChanges() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    startNewRegistrationPeriod(undo = false) {
        const tree = GroupCategoryTree.build(this.category, this.organization.meta.categories, this.organization.groups)
        const initialGroupIds =  tree.getAllGroups().map(g => g.id)
        this.present(new ComponentWithProperties(EndRegistrationPeriodView, { initialGroupIds, undo }).setDisplayStyle("popup"))
    }
}
</script>
