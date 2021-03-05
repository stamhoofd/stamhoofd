<template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Lidgeld">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>Lidgeld</h1>
            <p>Je kan later nog het lidgeld per (leeftijds)groep wijzigen.</p>

            <STErrorsDefault :error-box="errorBox" />

            <EditGroupPriceBox :validator="validator" :prices="getPrices()" @patch="addPricesPatch" />
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, PatchableArray,PatchableArrayAutoEncoder,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager,NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ColorInput, DateSelection, ErrorBox, FileInput,IBANInput, ImageInput, LoadingButton, Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, TimeInput, Toast, Validator} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, File, GroupCategory, GroupCategorySettings, GroupCategoryTree, GroupPrices, Image, Organization, OrganizationMetaData, OrganizationModules, OrganizationPatch, OrganizationPrivateMetaData,OrganizationTypeHelper,PaymentMethod, ResolutionFit, ResolutionRequest, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import EditCategoryGroupsView from '../../../groups/EditCategoryGroupsView.vue';
import EditGroupPriceBox from '../../../groups/EditGroupPriceBox.vue';
import EditGroupsView from '../../../groups/EditGroupsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import DomainSettingsView from './DomainSettingsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        Radio,
        BackButton,
        TimeInput,
        LoadingButton,
        EditGroupPriceBox
    },
})
export default class MembersPriceSetupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>> ) {
        this.organizationPatch = this.organizationPatch.patch(OrganizationPatch.create({ 
            meta: OrganizationMetaData.patch(patch)
        }))
    }

    getPrices() {
        return this.organization.meta.defaultPrices
    }

    addPricesPatch(patch: PatchableArrayAutoEncoder<GroupPrices>) {
        this.addMetaPatch({ defaultPrices: patch })
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
      
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            this.addMetaPatch({ modules: OrganizationModules.patch({ useMembers: true })})
            await OrganizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: OrganizationManager.organization.id })
            new Toast('De ledenadministratie module is nu actief', "success green").show()
            this.manageGroups(true)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    get enableActivities() {
        return this.organization.meta.modules.useActivities
    }

    manageGroups(animated = true) {
        if (!this.organization.meta.rootCategory) {
            // Auto restore missing root category
            const category = GroupCategory.create({})
            const meta = OrganizationMetaData.patch({
                rootCategoryId: category.id
            })
            meta.categories.addPut(category)

            const p = Organization.patch({
                id: this.organization.id,
                meta
            })
            
            this.navigationController!.push(
                new ComponentWithProperties(EditCategoryGroupsView, { 
                    category: category, 
                    organization: this.organization.patch(p), 
                    saveHandler: async (patch: AutoEncoderPatchType<Organization>) => {
                        patch.id = this.organization.id
                        await OrganizationManager.patch(p.patch(patch))
                    }
                })
            , true, this.navigationController!.components.length)
            return
        }

        let cat = this.organization.meta.rootCategory

        let p = Organization.patch({
            id: this.organization.id
        })

        if (!this.enableActivities) {
            const full = GroupCategoryTree.build(cat, this.organization.meta.categories, this.organization.groups)
            if (full.categories.length === 0) {

                // Create a new one and open that one instead
                const defaultCategories = OrganizationTypeHelper.getDefaultGroupCategories(this.organization.meta.type, this.organization.meta.umbrellaOrganization ?? undefined)
                const category = defaultCategories[0] ?? GroupCategory.create({
                    settings: GroupCategorySettings.create({
                        name: "Leeftijdsgroepen",
                        
                    })
                })
                category.groupIds = this.organization.groups.map(g => g.id)
                
                const meta = OrganizationMetaData.patch({})
                meta.categories.addPut(category)

                const me = GroupCategory.patch({ id: cat.id })
                me.categoryIds.addPut(category.id)
                meta.categories.addPatch(me)

                p = p.patch({
                    meta
                })

                cat = category

            } else {
                cat = full.categories[0]
            }
        }
        this.navigationController!.push(new ComponentWithProperties(EditCategoryGroupsView, {
            category: cat,
            organization: this.organization.patch(p),
            saveHandler: async (patch) => {
                patch.id = this.organization.id
                await OrganizationManager.patch(p.patch(patch))
            }
        }), true, this.navigationController!.components.length)
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
