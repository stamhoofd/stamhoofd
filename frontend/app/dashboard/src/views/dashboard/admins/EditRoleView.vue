<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Titel" error-fields="name" :error-box="errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze rol"
                autocomplete=""
            >
        </STInputBox>

        <hr>
        <h2>Basistoegang</h2>
        <p>Geef deze beheerders snel lees of bewerk toegang tot alle onderdelen van jouw vereniging.</p>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" value="None" />
                </template>
                <h3 class="style-title-list">
                    Geen
                </h3>
                <p v-if="basePermission === 'None'" class="style-description-small">
                    Deze beheerders kunnen geen onderdelen zien of bewerken tenzij expliciet hieronder toegang werd gegeven.
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" value="Read" />
                </template>
                <h3 class="style-title-list">
                    Lezen
                </h3>
                <p v-if="basePermission === 'Read'" class="style-description-small">
                    Deze beheerders kunnen alle onderdelen zien. Je kan ze eventueel bewerk toegang geven tot specifieke onderdelen.
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="basePermission" value="Write" />
                </template>
                <h3 class="style-title-list">
                    Bewerken
                </h3>
                <p v-if="basePermission === 'Write'" class="style-description-small">
                    Deze beheerders kunnen alle onderdelen zien en bewerken. Je kan ze eventueel toegang geven tot instellingen (volledige toegang) voor specifieke onderdelen.
                </p>
            </STListItem>
        </STList>

        <template v-if="enableActivities">
            <hr>
            <h2>
                Inschrijvingscategorieën
            </h2>
            <p>Geef deze beheerders meteen toegang tot alle inschrijvingsgroepen uit een categorie, of geef ze zelf de mogelijkheid om inschrijvingsgroepen (bv. activiteiten of leeftijdsgroepen) aan te maken in één of meerdere categorieën. Enkel hoofdbeheerders kunnen categorieën toevoegen en bewerken.</p>
           
            <STList>
                <GroupCategoryPermissionRow v-for="category in categories" :key="category.id" type="category" :role="patchedRole" :organization="patchedOrganization" :category="category" @patch="addPatch" />

                <STListItem :selectable="true" @click="editCategories()">
                    <span class="button text">
                        <span class="icon add" />
                        <span>Categorie toevoegen</span>
                    </span>
                </STListItem>
            </STList>
        </template>

        <div v-if="enableMemberModule" class="container">
            <hr>
            <h2>
                Individuele inschrijvingsgroepen
            </h2>

            <STList>
                <GroupPermissionRow v-for="group in groups" :key="group.id" :role="patchedRole" :organization="patchedOrganization" :group="group" @patch="addPatch" />
                <STListItem :selectable="true" @click="editGroups()">
                    <span class="button text">
                        <span class="icon add" />
                        <span>Groep toevoegen</span>
                    </span>
                </STListItem>
            </STList>
        </div>

        <div v-if="enableWebshopModule" class="container">
            <hr>
            <h2>Webshops</h2>
            <p>Voeg webshops toe om deze beheerders toegang te geven tot een specifieke webshop</p>

            <STList>
                <STListItem :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="createWebshops" />
                    </template>
                    Kan nieuwe webshops maken
                </STListItem>
                <WebshopPermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patchedRole" :organization="patchedOrganization" :webshop="webshop" type="webshop" @patch="addPatch" />

                <STListItem :selectable="true" @click="editWebshops()">
                    <span class="button text">
                        <span class="icon add" />
                        <span>Webshop toevoegen</span>
                    </span>
                </STListItem>
            </STList>
        </div>

        <hr>
        <h2>Boekhouding</h2>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="financeDirector" />
                </template>
                <h3 class="style-title-list">
                    Volledige toegang
                </h3>
                <p class="style-description-small">
                    Beheerders met deze toegang krijgen toegang tot alle financiële gegevens van jouw organisatie, en kunnen overschrijvingen als betaald markeren.
                </p>
            </STListItem>
            <STListItem v-if="!financeDirector" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="managePayments" />
                </template>
                <h3 class="style-title-list">
                    Overschrijvingen beheren
                </h3>
                <p class="style-description-small">
                    Beheerders met deze toegang kunnen openstaande overschrijvingen bekijken en markeren als betaald.
                </p>
            </STListItem>
        </STList>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze rol
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>

        <hr>
        <h2>Beheerders met deze rol</h2>

        <STList>
            <STListItem v-for="admin in sortedAdmins" :key="admin.id" element-name="label" :selectable="true">
                <template #left>
                    <Checkbox :modelValue="hasAdminRole(admin)" @update:modelValue="setAdminRole(admin, $event)" />
                </template>

                <h2 class="style-title-list">
                    {{ admin.firstName }} {{ admin.lastName }}
                </h2>
                <p class="style-description-small">
                    {{ admin.email }}
                </p>
            </STListItem>
        </STList>
    </SaveView>
</template>


<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, Radio, SaveView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Group, GroupCategory, Organization, OrganizationPrivateMetaData, PermissionLevel, PermissionRole, PermissionRoleDetailed, Permissions, User, Version, WebshopPreview } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import EditRoleCategoriesView from './EditRoleCategoriesView.vue';
import EditRoleGroupsView from './EditRoleGroupsView.vue';
import EditRoleWebshopsView from './EditRoleWebshopsView.vue';
import GroupCategoryPermissionRow from './GroupCategoryPermissionRow.vue';
import GroupPermissionRow from './GroupPermissionRow.vue';
import WebshopPermissionRow from './WebshopPermissionRow.vue';

@Component({
    components: {
        Checkbox,
        Radio,
        SaveView,
        STList,
        STListItem,
        Spinner,
        BackButton,
        STInputBox,
        STErrorsDefault,
        LoadingButton,
        GroupPermissionRow,
        GroupCategoryPermissionRow,
        WebshopPermissionRow
    }
})
export default class EditRoleView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop({ required: true })
        role: PermissionRoleDetailed

    @Prop({ required: true })
        isNew: boolean

    @Prop({ required: true })
        organization: Organization
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<Organization>) => Promise<void>);

    SessionManager = SessionManager // needed to make session reactive
    loading = true

    mounted() {
        this.load().catch(e => {
            console.error(e)
        })

        if (this.isNew) {
            UrlHelper.setUrl("/settings/admins/roles/new")
        } else {
            UrlHelper.setUrl("/settings/admins/roles/" + Formatter.slug(this.role.name))
        }
        document.title = "Stamhoofd - " + this.title
    }

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedRole() {
        const c = this.patchedOrganization.privateMeta?.roles.find(c => c.id == this.role.id)
        if (c) {
            return c
        }
        return this.role
    }

    get title() {
        return this.isNew ? "Nieuwe rol" : this.patchedRole.name
    }

    get name() {
        return this.patchedRole.name
    }

    set name(name: string) {
        this.addRolePatch(
            PermissionRoleDetailed.patch({ 
                name
            })
        )
    }

    get basePermission() {
        return this.patchedRole.level
    }

    set basePermission(basePermission: PermissionLevel) {
        this.addRolePatch(
            PermissionRoleDetailed.patch({ 
                level: basePermission
            })
        )
    }

    get createWebshops() {
        return this.patchedRole.createWebshops
    }

    set createWebshops(createWebshops: boolean) {
        this.addRolePatch(
            PermissionRoleDetailed.patch({ 
                createWebshops
            })
        )
    }


    get managePayments() {
        return this.patchedRole.managePayments
    }

    set managePayments(managePayments: boolean) {
        this.addRolePatch(
            PermissionRoleDetailed.patch({ 
                managePayments
            })
        )
    }

    get financeDirector() {
        return this.patchedRole.financeDirector
    }

    set financeDirector(financeDirector: boolean) {
        this.addRolePatch(
            PermissionRoleDetailed.patch({ 
                financeDirector
            })
        )
    }

    editGroups() {
        this.present(new ComponentWithProperties(EditRoleGroupsView, {
            role: this.patchedRole,
            organization: this.patchedOrganization,
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    editCategories() {
        this.present(new ComponentWithProperties(EditRoleCategoriesView, {
            role: this.patchedRole,
            organization: this.patchedOrganization,
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    editWebshops() {
        this.present(new ComponentWithProperties(EditRoleWebshopsView, {
            role: this.patchedRole,
            organization: this.patchedOrganization,
            saveHandler: (patch: AutoEncoderPatchType<Organization>) => {
                this.addPatch(patch)
            }
        }).setDisplayStyle("popup"))
    }

    get groups(): Group[] {
        const g = new Map<string, Group>()

        // Keep both old and new
        for (const group of this.organization.groups) {
            if (group.privateSettings?.permissions.full.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateSettings?.permissions.write.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateSettings?.permissions.read.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }
        }

        for (const group of this.patchedOrganization.groups) {
            if (group.privateSettings?.permissions.full.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateSettings?.permissions.write.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateSettings?.permissions.read.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (g.has(group.id)) {
                // Override with patched value
                g.set(group.id, group)
            }
        }

        return [...g.values()]
    }

    get categories(): GroupCategory[] {
        const g = new Map<string, GroupCategory>()

        // Keep both old and new
        for (const category of this.organization.meta.categories) {
            if (category.settings.permissions.create.find(r => r.id === this.role.id)) {
                g.set(category.id, category)
                continue
            }
            if (category.settings.permissions.groupPermissions.roleHasAccess(this.role)) {
                g.set(category.id, category)
                continue
            }
        }

        for (const category of this.patchedOrganization.meta.categories) {
            if (category.settings.permissions.create.find(r => r.id === this.role.id)) {
                g.set(category.id, category)
                continue
            }

            if (category.settings.permissions.groupPermissions.roleHasAccess(this.role)) {
                g.set(category.id, category)
                continue
            }

            if (g.has(category.id)) {
                // Override with patched value
                g.set(category.id, category)
            }
        }

        return [...g.values()]
    }

    get webshops(): WebshopPreview[] {
        const g = new Map<string, WebshopPreview>()

        // Keep both old and new
        for (const group of this.organization.webshops) {
            if (group.privateMeta.permissions.roleHasAccess(this.role)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateMeta.scanPermissions.roleHasAccess(this.role)) {
                g.set(group.id, group)
                continue
            }
        }

        for (const group of this.patchedOrganization.webshops) {
            if (group.privateMeta.permissions.roleHasAccess(this.role)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateMeta.scanPermissions.roleHasAccess(this.role)) {
                g.set(group.id, group)
                continue
            }

            if (g.has(group.id)) {
                // Override with patched value
                g.set(group.id, group)
            }
        }

        return [...g.values()]
    }

    addRolePatch(patch: AutoEncoderPatchType<PermissionRoleDetailed>) {
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addPatch(PermissionRoleDetailed.patch(Object.assign({}, patch, { id: this.role.id })))

        this.addPatch(Organization.patch({
            privateMeta
        }))
    }

    addPatch(patch: AutoEncoderPatchType<Organization>) {
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    async load() {
        await this.$organizationManager.loadAdmins(false, true, this)
        this.loading = false
    }

    beforeUnmount() {
        // Clear all pending requests
        Request.cancelAll(this)
    }

    get admins() {
        return (this.patchedOrganization.admins ?? [])
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    get enableActivities() {
        return this.organization.meta.modules.useActivities
    }

    get sortedAdmins() {
        return this.admins.slice().sort((a, b) => Sorter.byStringValue(a.firstName+" "+a.lastName, b.firstName+" "+b.lastName))
    }

    hasAdminRole(admin: User) {
        return admin.permissions?.roles.find(f => f.id === this.role.id) ?? false
    }

    setAdminRole(admin: User, enable: boolean) {
        const permissionPatch = Permissions.patch({})

        if (enable) {
            if (this.hasAdminRole(admin)) {
                return
            }
            permissionPatch.roles.addPut(PermissionRole.create(this.role))
        } else {
            permissionPatch.roles.addDelete(this.role.id)
        }
        const userPatch = User.patch({
            id: admin.id,
            permissions: permissionPatch
        })
        const p = Organization.patch({})
        p.admins!.addPatch(userPatch)
        this.addPatch(p)
        console.log(p)
    }

    async save() {
        if (this.saving) {
            return
        }
        this.saving = true;

        try {
            if (this.name.length === 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: "Gelieve een titel in te vullen",
                    field: "name"
                })
            }
            await this.saveHandler(this.patchOrganization)
            this.pop({ force: true }) 
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    async deleteMe() {
        if (this.saving) {
            return
        }
        
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze rol wilt verwijderen?", "Verwijderen")) {
            return
        }
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addDelete(this.role.id)
        const p = Organization.patch({
            privateMeta
        })
        this.saving = true;

        try {
            await this.saveHandler(p)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    get hasChanges() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}

</script>