<template>
    <SaveView :loading="saving" :disabled="!hasChanges" title="Webshoptoegang" @save="save">
        <h1>
            Toegang tot webshops aanpassen
        </h1>

        <STErrorsDefault :error-box="errorBox" />
            
        <p v-if="webshops.length === 0" class="info-box">
            Je hebt momenteel nog geen webshops aangemaakt
        </p>

        <STList>
            <WebshopPermissionRow v-for="webshop in webshops" :key="webshop.id" :role="patchedRole" :organization="patchedOrganization" :webshop="webshop" type="webshop" @patch="addPatch" />
        </STList>
    </SaveView>
</template>


<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STList, STListItem, Validator } from "@stamhoofd/components";
import { Organization, PermissionRoleDetailed, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import WebshopPermissionRow from './WebshopPermissionRow.vue';

@Component({
    components: {
        STList,
        STListItem,
        STErrorsDefault,
        SaveView,
        WebshopPermissionRow
    }
})
export default class EditRoleWebshopsView extends Mixins(NavigationMixin) {
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

    get webshops() {
        return this.patchedOrganization.webshops
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