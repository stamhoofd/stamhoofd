import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { AskRequirement, MemberDetails, MemberWithRegistrations, Version } from '@stamhoofd/structures';
import { component } from 'vue/types/umd';

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

export enum EditMemberStepType {
    "Details" = "Details",
    "Parents" = "Parents", // Only if meets criteria
    "EmergencyContact" = "EmergencyContact",
    "Records" = "Records", // Olny if enabled
    // todo: Questions step
}

export class EditMemberStep {
    type: EditMemberStepType

    constructor(type: EditMemberStepType) {
        this.type = type
    }

    async getComponent(): Promise<any> {
        switch (this.type) {
            case EditMemberStepType.Details: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberGeneralView.vue')).default;
            case EditMemberStepType.Parents: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberGeneralView.vue')).default;
            case EditMemberStepType.EmergencyContact: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberGeneralView.vue')).default;
            case EditMemberStepType.Records: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberGeneralView.vue')).default;

            default: {
                // If you get a compile error here, a type is missing in the switch and you should add it
                const t: never = this.type
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                throw new Error("Missing component for "+t)
            }
        }
    }

    shouldSkip(details: MemberDetails): boolean {
        switch (this.type) {
            // Skip parents for > 18 and has address, or > 27 (no matter of address)
            case EditMemberStepType.Parents: return ((details.age ?? 99) >= 18 && details.address !== null) || (details.age ?? 99) > 27;

            // Skip emergency contacts if not asked by organization
            case EditMemberStepType.EmergencyContact: return OrganizationManager.organization.meta.recordsConfiguration.emergencyContact === AskRequirement.NotAsked

            // Skip records if not asked by organization for this age
            case EditMemberStepType.Records: return OrganizationManager.organization.meta.recordsConfiguration.shouldSkipRecords(details.age ?? null)
        }
        return false
    }

    /// What happens when shouldSkip returned true, most of the time we need to clear some old data
    onSkip(details: MemberDetails) {
        switch (this.type) {
            // Skip parents for > 18 and has address, or > 24 (no matter of address)
            case EditMemberStepType.Parents: 
                details.parents = []
                break;

            // Skip emergency contacts if not asked by organization
            case EditMemberStepType.EmergencyContact: 
                details.emergencyContacts = []
                break;

            // Skip records if not asked by organization for this age
            case EditMemberStepType.Records: 
                details.records = []
                break;
        }
    }

}

export class EditMemberStepsManager {
    editMember: MemberWithRegistrations | null = null
    isNew = true
    types: EditMemberStepType[]
    finishHandler: (component: NavigationMixin) => Promise<void>;

    /**
     * Intialise a new step flow with all the given steps
     */
    constructor(types: EditMemberStepType[], editMember?: MemberWithRegistrations, finishHandler?: (component: NavigationMixin) => Promise<void>) {
        this.types = types
        if (editMember) {
            this.editMember = editMember
            this.isNew = false
        }

        if (finishHandler) {
            this.finishHandler = finishHandler
        } else {
            this.finishHandler = (component: NavigationMixin) => {
                component.dismiss({force: true })
                return Promise.resolve()
            }
        }
    }
    /**
     * Create a new copy of the current details for editing
     */
    cloneDetails(details?: MemberDetails): MemberDetails {
        if (details) {
            // Return a clone
            return new ObjectData(details.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        }
        if (this.editMember) {
            // Return a clone
            return new ObjectData(this.editMember.details.encode({ version: Version }), { version: Version }).decode(MemberDetails as Decoder<MemberDetails>)
        }

        // Return a new member
        return MemberDetails.create({})
    }

    async saveDetails(details: MemberDetails) {
        // Save or create member if needed
        if (this.editMember) {
            this.editMember.details = details
            await MemberManager.patchAllMembersWith(this.editMember)
        } else {
            const m = await MemberManager.addMember(details)
            if (!m) {
                throw new SimpleError({
                    code: "expected_member",
                    message: "Er ging iets mis bij het opslaan."
                })
            }
            this.editMember = m
        }
    }

    /// Return all the steps that are confirmed with the current checkout configuration
    getSteps(): EditMemberStep[] {
        const steps: EditMemberStep[] = []

        for (const type of this.types) {
            steps.push(new EditMemberStep(
                type
            ))
        }

        return steps
    }

    /**
     * Get the next step, executing possible mutations on member details if some steps are skipped
     */
    private getNextStep(step: EditMemberStepType | undefined, details: MemberDetails) {

        const steps = this.getSteps()
        let next = step === undefined
        for (const s of steps) {
            if (next) {
                if (!s.shouldSkip(details)) {
                    return s
                }

                // skip this step
                s.onSkip(details)
                continue
            }

            if (s.type === step) {
                next = true
            }
        }

        // Last step
        return undefined
    }

    async getFirstComponent(): Promise<ComponentWithProperties | undefined> {
        return this.getNextComponent(undefined, this.cloneDetails())
    }

    /**
     * Get the next component, executing possible mutations on member details if some steps are skipped
     */
    private async getNextComponent(currentType: EditMemberStepType | undefined, details: MemberDetails): Promise<ComponentWithProperties | undefined> {

        const step = this.getNextStep(currentType, details)
        if (!step) {
            return undefined
        }
        return new ComponentWithProperties(await step.getComponent(), {
            // Details to edit (can happen directly, no need to copy again)
            details: this.cloneDetails(details),
            isNew: this.isNew,

            // Save details on complete
            saveHandler: async (details: MemberDetails, component: NavigationMixin): Promise<void> => {
                const next = await this.getNextComponent(step.type, details)

                // Save details AFTER determining the next component (because onSkip behaviour might update the details)
                await this.saveDetails(details)

                if (!next) {
                    await this.finishHandler(component)
                } else {
                    component.show(next)
                }
            }
        })
    }
}