import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, Toast, Validator } from "@stamhoofd/components";
import { FinancialSupportSettings, Group, GroupPrices, GroupPrivateSettings, GroupSettings, Organization, OrganizationMetaData, OrganizationRecordsConfiguration, Version } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component
export default class EditGroupMixin extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        group: Group

    /**
     *  == patched organization <-> $organization (= unpatched)
     */
    @Prop({ required: true })
        organization: Organization

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<Organization>) => Promise<void>);
    
    patchOrganization: AutoEncoderPatchType<Organization> = Organization.patch({})

    get isNew() {
        return !this.$organization.groups.find(g => g.id === this.group.id)
    }

    saving = false

    errorBox: ErrorBox | null = null
    validator = new Validator()

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedGroup() {
        const c = this.patchedOrganization.groups.find(c => c.id == this.group.id)
        if (c) {
            return c
        }
        return this.group
    }

    addOrganizationPatch(patch: AutoEncoderPatchType<Organization>) {
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    addPatch(patch: AutoEncoderPatchType<Group>) {
        patch.id = this.group.id
        const p = Organization.patch({});
        p.groups.addPatch(patch)
        this.addOrganizationPatch(p)
    }

    addPricesPatch(patch: PatchableArrayAutoEncoder<GroupPrices>) {
        this.addSettingsPatch({ prices: patch })
    }

    addSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupSettings>> ) {
        this.addPatch(Group.patch({ 
            id: this.group.id, 
            settings: GroupSettings.patch(patch)
        }))
    }

    addPrivateSettingsPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<GroupPrivateSettings>> ) {
        this.addPatch(Group.patch({ 
            id: this.group.id, 
            privateSettings: GroupPrivateSettings.patch(patch)
        }))
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

    validate(): Promise<void> | void {
        // override if needed
    }

    shouldDismiss(): Promise<boolean> | boolean {
        return true
    }

    async save() {
        if (this.saving) {
            return
        }

        this.saving = true

        try {
            if (!await this.validator.validate()) {
                this.saving = false
                return
            }

            await this.validate()

            let patch = this.patchOrganization

            // Check if reduced price is enabled
            if (!this.patchedOrganization.meta.recordsConfiguration.financialSupport && !!this.patchedGroup.settings.prices.find(g => !!g.prices.find(gg => gg.reducedPrice !== null))) {
                const patchOrganization = Organization.patch({
                    meta:  OrganizationMetaData.patch({
                        recordsConfiguration: OrganizationRecordsConfiguration.patch({
                            financialSupport: FinancialSupportSettings.create({})
                        })
                    })
                })

                patch = patch.patch(patchOrganization)

                new Toast("Kijk zeker de instellingen voor 'Financiële ondersteuning' na bij de instellingen. We vragen nu bij het inschrijven of een lid financiële ondersteuning nodig heeft, zodat we de verminderde prijzen kunnen toepassen.", "warning yellow").setHide(15*1000).show()
            }

            await this.saveHandler(patch)
           
            const dis = await this.shouldDismiss()
            if (dis) {
                this.dismiss({ force: true })
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }
  
}