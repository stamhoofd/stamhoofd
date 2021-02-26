<template>
    <div class="st-view">
        <STNavigationBar title="Toegang tot inschrijvingsgroepen aanpassen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                Toegang tot inschrijvingsgroepen aanpassen
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <div class="container" v-for="category in tree.categories" :key="category.id">
                
                <hr>
                <h2>{{ category.settings.name }}</h2>

                <STList v-if="category.groups.length > 0">
                    <STListItem v-for="group in category.groups" :key="group.id" element-name="label" :selectable="true">
                        <Checkbox slot="left" :checked="getSelectGroup(group)" @change="setSelectGroup(group, $event)" />
                        <h2 class="style-title-list">
                            {{ group.settings.name }}
                        </h2>

                        <div slot="right" v-if="getSelectGroup(group)">
                            <button class="button text" @click.stop.prevent>
                                <span>{{ getGroupPermission(group) }}</span>
                                <span class="icon arrow-down-small" />
                            </button>
                        </div>
                    </STListItem>
                </STList>

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
import { AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupPrivateSettings, Organization, OrganizationAdmins, OrganizationPrivateMetaData, PermissionRole,PermissionRoleDetailed, PermissionsByRole, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
        LoadingButton
    }
})
export default class EditRoleGroupsView extends Mixins(NavigationMixin) {
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

    /// Returns a flattened category tree with maximum 2 levels
    get tree() {
        return this.patchedOrganization.getCategoryTreeWithDepth(1)
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

    getSelectGroup(group: Group) {
        return this.getGroupPermission(group) !== "none"
    }

    setSelectGroup(group: Group, selected: boolean) {
        if (selected === this.getSelectGroup(group)) {
            return
        }

        console.log(group, selected)
        
        if (selected) {
            this.setGroupPermission(group, "read")
        } else {
            this.setGroupPermission(group, "none")
        }
    }

    getGroupPermission(group: Group): "none" | "write" | "read" | "full" {
        for (const role of group.privateSettings!.permissions.full) {
            if (role.id === this.role.id) {
                return "full"
            }
        }

        for (const role of group.privateSettings!.permissions.write) {
            if (role.id === this.role.id) {
                return "write"
            }
        }

        for (const role of group.privateSettings!.permissions.read) {
            if (role.id === this.role.id) {
                return "read"
            }
        }

        return "none"
    }

    setGroupPermission(group: Group, level: "none" | "write" | "read" | "full") {
        if (this.getGroupPermission(group) === level) {
            return
        }

        const p = Organization.patch({ id: this.organization.id })
        const del: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        del.addDelete(this.role.id)

        const add: PatchableArrayAutoEncoder<PermissionRole> = new PatchableArray()
        add.addPut(this.role)

        if (level === "none") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: del,
                        full: del
                    })
                })
            }))
            this.addPatch(p)
            return
        }

        if (level === "read") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: add,
                        write: del,
                        full: del
                    })
                })
            }))
            this.addPatch(p)
            console.log(p)
            console.log(this.patchedOrganization)
            return
        }

        if (level === "write") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: add,
                        full: del
                    })
                })
            }))
            this.addPatch(p)
            return
        }

        if (level === "full") {
            p.groups.addPatch(Group.patch({
                id: group.id,
                privateSettings: GroupPrivateSettings.patch({
                    permissions: PermissionsByRole.patch({
                        read: del,
                        write: del,
                        full: add
                    })
                })
            }))
            this.addPatch(p)
            return
        }
    }


    save() {
        this.saveHandler(this.patchOrganization)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}

</script>