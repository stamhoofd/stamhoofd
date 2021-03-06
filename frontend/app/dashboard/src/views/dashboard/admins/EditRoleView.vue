<template>
    <div class="st-view">
        <STNavigationBar title="Beheerders">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
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

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Naam van deze groep"
                    autocomplete=""
                >
            </STInputBox>

            <div v-if="enableMemberModule" class="container">
                <hr>
                <h2 class="style-with-button">
                    <div>
                        Inschrijvingsgroepen
                    </div>
                    <div>
                        <button class="button text" @click="editGroups()">
                            <span class="icon add"/>
                            <span class="hide-smartphone">Toevoegen</span>
                        </button>
                    </div>
                </h2>

                <STList v-if="groups.length > 0">
                    <GroupPermissionRow v-for="group in groups" :key="group.id" :role="patchedRole" :organization="patchedOrganization" :group="group" @patch="addPatch" />
                </STList>

                <p v-else class="info-box">
                    Deze beheerdersgroep heeft geen toegang tot inschrijvingsgroepen
                </p>

                <template v-if="enableActivities">
                    <hr>
                    <h2 class="style-with-button">
                        <div>
                            Inschrijvingscategorieën
                        </div>
                        <div>
                            <button class="button text" @click="editCategories()">
                                <span class="icon add"/>
                                <span class="hide-smartphone">Toevoegen</span>
                            </button>
                        </div>
                    </h2>
                    <p>Geef deze beheerders zelf de mogelijkheid om zelf inschrijvingsgroepen (bv. activiteiten of leeftijdsgroepen) aan te maken in één of meerdere categorieën. Enkel hoofdbeheerders kunnen categorieën toevoegen en bewerken.</p>

                    <STList v-if="categories.length > 0">
                        <CategoryPermissionRow v-for="category in categories" :key="category.id" :role="patchedRole" :organization="patchedOrganization" :category="category" @patch="addPatch" />
                    </STList>

                    <p v-else class="info-box">
                        Deze beheerdersgroep kan geen inschrijvingsgroepen maken
                    </p>
                </template>
            </div>

            <div v-if="enableWebshopModule" class="container">
                <hr>
                <h2 class="style-with-button">
                    <div>
                        Webshops
                    </div>
                    <div>
                        <button class="button text" @click="editWebshops()">
                            <span class="icon add"/>
                            <span class="hide-smartphone">Toevoegen</span>
                        </button>
                    </div>
                </h2>

                <STList>
                    <STListItem :selectable="true" element-name="label">
                        <Checkbox v-model="createWebshops" slot="left" />
                        Kan nieuwe webshops maken
                    </STListItem>
                    <WebshopPermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patchedRole" :organization="patchedOrganization" :webshop="webshop" @patch="addPatch" />
                </STList>

                <p v-if="webshops.length == 0" class="info-box">
                    Deze beheerdersgroep heeft geen toegang tot webshops
                </p>
            </div>

            <hr>
            <h2>Overschrijvingen</h2>

            <Checkbox v-model="managePayments">
                Kan overschrijvingen bekijken en beheren
            </Checkbox>

            <hr>
            <h2>Beheerders in deze groep</h2>

            <STList>
                <STListItem v-for="admin in sortedAdmins" :key="admin.id" element-name="label" :selectable="true">
                    <Checkbox slot="left" :checked="hasAdminRole(admin)" @change="setAdminRole(admin, $event)" />

                    <h2 class="style-title-list">
                        {{ admin.firstName }} {{ admin.lastName }}
                    </h2>
                    <p class="style-description-small">
                        {{ admin.email }}
                    </p>
                </STListItem>

                <STListItem v-for="invite in invites" :key="invite.id" element-name="label" :selectable="true">
                    <Checkbox slot="left" :checked="hasAdminRole(invite)" @change="setInviteRole(invite, $event)" />

                    <h2 class="style-title-list">
                        {{ invite.userDetails.firstName || "?" }} {{ invite.userDetails.lastName || "" }}
                    </h2>
                    <p class="style-description-small">
                        {{ invite.userDetails.email }}
                    </p>
                </STListItem>
            </STList>
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
import { AutoEncoderPatchType, Decoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupCategory, Invite, Organization, OrganizationAdmins, OrganizationPrivateMetaData, PermissionRole,PermissionRoleDetailed, Permissions, User, Version, WebshopPreview } from '@stamhoofd/structures';
import { Sorter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";
import EditRoleGroupsView from './EditRoleGroupsView.vue';
import GroupPermissionRow from './GroupPermissionRow.vue';
import CategoryPermissionRow from './CategoryPermissionRow.vue';
import EditRoleCategoriesView from './EditRoleCategoriesView.vue';
import EditRoleWebshopsView from './EditRoleWebshopsView.vue';
import WebshopPermissionRow from './WebshopPermissionRow.vue';

@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Spinner,
        BackButton,
        STInputBox,
        STErrorsDefault,
        LoadingButton,
        GroupPermissionRow,
        CategoryPermissionRow,
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

    get isNew() {
        return this.patchedRole.name.length == 0
    }

    get title() {
        return this.isNew ? "Nieuwe beheerdersgroep" : this.patchedRole.name
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
        }

        for (const category of this.patchedOrganization.meta.categories) {
            if (category.settings.permissions.create.find(r => r.id === this.role.id)) {
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
            if (group.privateMeta?.permissions.full.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateMeta?.permissions.write.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateMeta?.permissions.read.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }
        }

        for (const group of this.patchedOrganization.webshops) {
            if (group.privateMeta?.permissions.full.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateMeta?.permissions.write.find(r => r.id === this.role.id)) {
                g.set(group.id, group)
                continue
            }

            if (group.privateMeta?.permissions.read.find(r => r.id === this.role.id)) {
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
        console.log(this.patchOrganization)
        console.log(this.patchedOrganization)
    }

    async load() {
        if (this.organization.admins && this.organization.invites) {
            this.loading = false
            return
        }

        const session = SessionManager.currentSession!
        const response = await session.authenticatedServer.request({
            method: "GET",
            path: "/organization/admins",
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>
        })

        this.organization.admins = response.data.users
        this.organization.invites = response.data.invites
        this.loading = false
    }

    get admins() {
        return (this.patchedOrganization.admins ?? [])
    }

    get invites() {
        return this.patchedOrganization.invites ?? []
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
        return this.admins.sort((a, b) => Sorter.byStringValue(a.firstName+" "+a.lastName, b.firstName+" "+b.lastName))
    }

    hasAdminRole(admin: User | Invite) {
        return admin.permissions?.roles.find(f => f.id === this.role.id) ?? false
    }

    setAdminRole(admin: User, enable: boolean) {
        console.log("set", enable)
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

    setInviteRole(admin: Invite, enable: boolean) {
        const permissionPatch = Permissions.patch({})

        if (enable) {
            if (this.hasAdminRole(admin)) {
                return
            }
            permissionPatch.roles.addPut(PermissionRole.create(this.role))
        } else {
            permissionPatch.roles.addDelete(this.role.id)
        }
        const userPatch = Invite.patch({
            id: admin.id,
            permissions: permissionPatch
        })
        const p = Organization.patch({})
        p.invites!.addPatch(userPatch)
        this.addPatch(p)
    }

    async save() {
        if (this.saving) {
            return
        }
        this.saving = true;

        try {
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
        
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze categorie wilt verwijderen?", "Verwijderen")) {
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