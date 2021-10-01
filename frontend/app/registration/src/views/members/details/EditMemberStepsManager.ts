import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { AskRequirement, MemberDetails, MemberWithRegistrations, Version } from '@stamhoofd/structures';

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

export enum EditMemberStepType {
    "Details" = "Details",
    "Parents" = "Parents", // Only if meets criteria
    "EmergencyContact" = "EmergencyContact",
    "Records" = "Records", // Olny if enabled
    // todo: Questions step
}

export interface EditMemberStep {
    getComponent(): Promise<any>

    /**
     * Skipping = this information should not get stored, and should even get removed
     */
    shouldSkip(details: MemberDetails): boolean

    /**
     * Remove the information that is stored in member details that normally would be asked in this step
     */
    onSkip(details: MemberDetails)
}

export class BuiltInEditMemberStep implements EditMemberStep {
    type: EditMemberStepType

    constructor(type: EditMemberStepType) {
        this.type = type
    }

    async getComponent(): Promise<any> {
        switch (this.type) {
            case EditMemberStepType.Details: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberGeneralView.vue')).default;
            case EditMemberStepType.Parents: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberParentsView.vue')).default;
            case EditMemberStepType.EmergencyContact: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditEmergencyContactView.vue')).default;
            case EditMemberStepType.Records: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberRecordsView.vue')).default;

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
                details.reviewTimes.markReviewed("parents")
                break;

            // Skip emergency contacts if not asked by organization
            case EditMemberStepType.EmergencyContact: 
                details.emergencyContacts = []
                details.reviewTimes.markReviewed("emergencyContacts")
                break;

            // Skip records if not asked by organization for this age
            case EditMemberStepType.Records: 
                details.records = []
                details.reviewTimes.markReviewed("records")
                break;
        }
    }

}

export class EditMemberStepsManager {
    editMember: MemberWithRegistrations | null = null
    isNew = true

    // force to do all steps (and not skip them)
    force = false

    /**
     * Text in the button on the last step
     */
    lastButtonText: string

    steps: EditMemberStep[]
    finishHandler: (component: NavigationMixin) => Promise<void>;
    lastSaveHandler?: (details: MemberDetails) => Promise<void>;

    /**
     * Intialise a new step flow with all the given steps
     */
    constructor(steps: EditMemberStep[], editMember?: MemberWithRegistrations, finishHandler?: (component: NavigationMixin) => Promise<void>) {
        this.steps = steps
        this.lastButtonText = "Klaar"

        if (editMember) {
            this.editMember = editMember
            this.isNew = false
            this.lastButtonText = "Opslaan"
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

    /**
     * Get the next step, executing possible mutations on member details if some steps are skipped
     */
    private getNextStep(step: EditMemberStep | undefined, details: MemberDetails) {
        let next = step === undefined

        for (const s of this.steps) {
            if (next) {
                if (this.force || !s.shouldSkip(details)) {
                    return s
                }

                // skip this step
                s.onSkip(details)
                continue
            }

            if (s === step) {
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
    private async getNextComponent(currentStep: EditMemberStep | undefined, details: MemberDetails): Promise<ComponentWithProperties | undefined> {

        const step = this.getNextStep(currentStep, details)
        if (!step) {
            return undefined
        }

        const hasNext = !!this.getNextStep(step, details)
        return new ComponentWithProperties(await step.getComponent(), {
            // Details to check if anything is changed
            originalDetails: this.cloneDetails(details),
            
            // Details to edit (can happen directly, no need to copy again)
            details: this.cloneDetails(details),
            isNew: this.isNew,
            nextText: hasNext ? "Doorgaan" : this.lastButtonText,

            // Save details on complete
            saveHandler: async (details: MemberDetails, component: NavigationMixin): Promise<void> => {
                const next = await this.getNextComponent(step, details)

                if (!next && this.lastSaveHandler) {
                    // Allow to still make changes to  the given details before saving it
                    await this.lastSaveHandler(details)
                }

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