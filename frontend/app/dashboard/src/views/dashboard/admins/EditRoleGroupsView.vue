<template>
    <SaveView :loading="saving" :disabled="!hasChanges" title="Toegang" @save="save">
        <h1>
            Toegang tot inschrijvingsgroepen aanpassen
        </h1>

        <STErrorsDefault :error-box="errorBox" />

        <div v-for="category in tree.categories" :key="category.id" class="container">
            <hr>
            <h2>{{ category.settings.name }}</h2>

            <STList v-if="category.groups.length > 0">
                <GroupPermissionRow v-for="group in category.groups" :key="group.id" :role="patchedRole" :organization="patchedOrganization" :group="group" @patch="addPatch" />
            </STList>
        </div>
    </SaveView>
</template>


<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { Organization, PermissionRoleDetailed, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import GroupPermissionRow from './GroupPermissionRow.vue';

@Component({
    components: {
        SaveView,
        STList,
        STListItem,
        STInputBox,
        STErrorsDefault,
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

    async save() {
        this.saving = true;
        try {
            await this.saveHandler(this.patchOrganization)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false;
    }

    get hasChanges() {
        return patchContainsChanges(this.patchOrganization, this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}

</script>