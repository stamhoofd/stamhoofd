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
                    <GroupPermissionRow v-for="group in category.groups" :key="group.id" :role="patchedRole" :organization="patchedOrganization" :group="group" @patch="addPatch" />
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupPrivateSettings, Organization, OrganizationAdmins, OrganizationPrivateMetaData, PermissionRole,PermissionRoleDetailed, PermissionsByRole, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import GroupPermissionRow from './GroupPermissionRow.vue';

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
        GroupPermissionRow
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