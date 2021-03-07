<template>
    <div class="st-view">
        <STNavigationBar title="Toegang tot categorieën aanpassen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <template slot="right">
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1>
                Toegang tot categorieën aanpassen
            </h1>

            <STErrorsDefault :error-box="errorBox" />
                
            <STList>
                <CategoryPermissionRow v-for="category in categories" :key="category.id" :role="patchedRole" :organization="patchedOrganization" :category="category" @patch="addPatch" />
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
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,Checkbox, ErrorBox, LoadingButton, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { Organization, PermissionRoleDetailed, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";
import CategoryPermissionRow from './CategoryPermissionRow.vue';

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
        CategoryPermissionRow
    }
})
export default class EditRoleCategoriesView extends Mixins(NavigationMixin) {
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
    get categories() {
        return this.patchedOrganization.meta.categories
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