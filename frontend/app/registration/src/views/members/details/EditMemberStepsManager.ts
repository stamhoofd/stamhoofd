import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { AskRequirement, MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RecordCategory, RegisterItem, Version } from '@stamhoofd/structures';

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

export enum EditMemberStepType {
    "Details" = "Details",
    "Parents" = "Parents", // Only if meets criteria
    "EmergencyContact" = "EmergencyContact",
    // todo: Questions step
}

export interface EditMemberStep {
    getComponent(baseProperties: any): Promise<ComponentWithProperties>

    /**
     * Skip this step and delete the information in it
     */
    shouldDelete(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean

    /**
     * Remove the information that is stored in member details that normally would be asked in this step
     */
    delete(details: MemberDetails)

    /**
     * Return whether this step should get reviewed for selecting a specific item.
     * If false, this step will get skipped, but the information won't get deleted.
     * -> usefull because we can skip a step we already asked not long ago (e.g. when selecting multiple groups prevent needing to review the same steps multiple times)
     */
    shouldReview(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean
}

/**
 * Note: we don't save the review times in non-encrypted form for own categories, because that could leak sensitive information as meta-data
 * -> e.g. only ask given category IF financial aid needed -> did review => leaks member needs financial aid. So we only store
 * this information in the encrypted blob. If the member is locked/key is missing, we do always ask the information again
 * -> we can later extend this to determine which information is sensitive and which not and detect if the category filter is sensitive or not
 * -> so we can detect if we can store the meta data in an unencrypted form when it doesn't leak sensitive information
 */
export class RecordCategoryStep implements EditMemberStep {
    category: RecordCategory

    /**
     * Force that we review this step (e.g. when validating it)
     */
    forceReview = false

    /**
     * Time in ms for when to force a review because the infomration is outdated
     */
    outdatedTime = 60*1000*60*24*31*3

    constructor(category: RecordCategory, forceReview = false) {
        this.category = category
        this.forceReview = forceReview
    }

    async getComponentClass(): Promise<any> {
        return (await import(/* webpackChunkName: "EditMemberRecordCategoryView", webpackPrefetch: true */ './EditMemberRecordCategoryView.vue')).default;
    }

    async getComponent(baseProperties): Promise<ComponentWithProperties> {
        return new ComponentWithProperties(await this.getComponentClass(), { ...baseProperties, category: this.category })
    }

    shouldDelete(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean {
        // Delete all the information in this category, if this is not asked in the given category
        if (this.category.filter) {
            return !this.category.filter.enabledWhen.doesMatch(new MemberDetailsWithGroups(details, member, items));
        }
        return false
    }

    delete(details: MemberDetails) {
        for (const record of this.category.getAllRecords()) {
            const index = details.recordAnswers.findIndex(a => a.settings.id == record.id)
            if (index != -1) {
                details.recordAnswers.splice(index, 1)
            }
        }
    }

    shouldReview(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean {
        if (this.forceReview) {
            return true
        }

        if (details.isRecovered) {
            // Always review if still encrypted
            return true
        }
        // Check all the properties in this category and check their last review times
        const records = this.category.getAllRecords()

        for (const record of records) {
            const answer = details.recordAnswers.find(a => a.settings.id === record.id)
            if (!answer || answer.isOutdated(this.outdatedTime)) {
                // This was never answered
                console.log("Need review: ", record, answer)
                return true
            }
        }

        // We got all the answers, and they are all very recent
        return false
    }
}

export class BuiltInEditMemberStep implements EditMemberStep {
    type: EditMemberStepType

    /**
     * Force that we review this step (e.g. when validating it)
     */
    forceReview = false

    /**
     * Time in ms for when to force a review because the infomration is outdated
     */
    outdatedTime = 60*1000*60*24*31*3

    constructor(type: EditMemberStepType, forceReview = false) {
        this.type = type
        this.forceReview = forceReview
    }

    /**
     * 
     * @param member 
     * @param item 
     * @returns 
     */
    shouldReview(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean {
        if (this.forceReview) {
            return true
        }

        if (!member) {
            // Always review for new members
            return true
        }

        switch (this.type) {
            case EditMemberStepType.Details: {
                if (member.details.isRecovered) {
                    const meta = member.getDetailsMeta()
                    // Review if never entered or saved
                    return !meta || !meta.hasMemberGeneral
                }
                // We still have all the data. Ask everything that is older than 3 months
                if (member.details.reviewTimes.isOutdated("details", this.outdatedTime)) {
                    return true
                }

                // Check missing information
                if (!member.details.phone && OrganizationManager.organization.meta.recordsConfiguration.phone?.requiredWhen?.doesMatch(details) === true) {
                    return true
                }

                if (!member.details.email && OrganizationManager.organization.meta.recordsConfiguration.emailAddress?.requiredWhen?.doesMatch(details) === true) {
                    return true
                }

                if (!member.details.address && OrganizationManager.organization.meta.recordsConfiguration.address?.requiredWhen?.doesMatch(details) === true) {
                    return true
                }

                if (!member.details.birthDay && OrganizationManager.organization.meta.recordsConfiguration.birthDay?.requiredWhen?.doesMatch(details) === true) {
                    return true
                }

                return false
            }
            case EditMemberStepType.Parents: {
                if (member.details.isRecovered) {
                    const meta = member.getDetailsMeta()
                    // Review if never entered or saved
                    return !meta || !meta.hasParents
                }
                // We still have all the data. Ask everything that is older than 3 months
                return member.details.reviewTimes.isOutdated("parents", this.outdatedTime) || (member.details.parents.length == 0 && OrganizationManager.organization.meta.recordsConfiguration.parents?.requiredWhen?.doesMatch(new MemberDetailsWithGroups(details, member, items)) === true)
            }
            case EditMemberStepType.EmergencyContact: {
                if (member.activeRegistrations.length == 0 && items.reduce((allWaitingList, item) => item.waitingList && allWaitingList, true)) {
                    // All items are on the waiting list only
                    // So never ask this information, since we don't need it right now
                    return false
                }

                if (member.details.isRecovered) {
                    
                    const meta = member.getDetailsMeta()
                    // Review if never entered or saved
                    return !meta || !meta.hasEmergency
                }
                return member.details.reviewTimes.isOutdated("emergencyContacts", this.outdatedTime) || (member.details.emergencyContacts.length == 0 && OrganizationManager.organization.meta.recordsConfiguration.emergencyContacts?.requiredWhen?.doesMatch(new MemberDetailsWithGroups(details, member, items)) === true)
            }
            /*case EditMemberStepType.Records: {
                if (member.activeRegistrations.length == 0 && items.reduce((allWaitingList, item) => item.waitingList && allWaitingList, true)) {
                    // All items are on the waiting list only
                    // So never ask this information, since we don't need it right now
                    return false
                }

                if (member.details.isRecovered) {
                    
                    const meta = member.getDetailsMeta()
                    // Review if never entered or saved
                    return !meta || !meta.hasRecords
                }
                return member.details.reviewTimes.isOutdated("records", this.outdatedTime)
            }*/

            default: {
                return true
            }
        }
    }

    async getComponentClass(): Promise<any> {
        switch (this.type) {
            case EditMemberStepType.Details: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberGeneralView.vue')).default;
            case EditMemberStepType.Parents: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditMemberParentsView.vue')).default;
            case EditMemberStepType.EmergencyContact: return (await import(/* webpackChunkName: "EditMemberGeneralView", webpackPrefetch: true */ './EditEmergencyContactView.vue')).default;

            default: {
                // If you get a compile error here, a type is missing in the switch and you should add it
                const t: never = this.type
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                throw new Error("Missing component for "+t)
            }
        }
    }

    async getComponent(baseProperties): Promise<ComponentWithProperties> {
        return new ComponentWithProperties(await this.getComponentClass(), baseProperties)
    }

    shouldDelete(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean {
        switch (this.type) {
            // Delete parents for > 18 and has address, or > 27 (no matter of address)
            case EditMemberStepType.Parents: return !OrganizationManager.organization.meta.recordsConfiguration.parents?.enabledWhen?.doesMatch(new MemberDetailsWithGroups(details, member, items));

            case EditMemberStepType.EmergencyContact: return !OrganizationManager.organization.meta.recordsConfiguration.emergencyContacts?.enabledWhen?.doesMatch(new MemberDetailsWithGroups(details, member, items));

            // Delete emergency contacts if not asked by organization
            //case EditMemberStepType.EmergencyContact: return OrganizationManager.organization.meta.recordsConfiguration.emergencyContact === AskRequirement.NotAsked
        }
        return false
    }

    /// What happens when shouldDelete returned true, most of the time we need to clear some old data
    delete(details: MemberDetails) {
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
        }
    }
}

export class EditMemberStepsManager {
    /**
     * Edit a member or leave empty for a new member creation
     */
    editMember: MemberWithRegistrations | null = null

    /**
     * For which register items do you want to provide the steps?
     */
    items: RegisterItem[] = []

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

    static getAllSteps(items: RegisterItem[] = [], member?: MemberWithRegistrations, forceReview = false): EditMemberStep[] {
        const base: EditMemberStep[] = [
            new BuiltInEditMemberStep(EditMemberStepType.Details, forceReview),
            new BuiltInEditMemberStep(EditMemberStepType.Parents, forceReview),
            new BuiltInEditMemberStep(EditMemberStepType.EmergencyContact, forceReview)
        ]

        for (const category of OrganizationManager.organization.meta.recordsConfiguration.recordCategories) {
            base.push(new RecordCategoryStep(category, forceReview))
        }

        // todo: categories that are bound to a single group (thats why we need items and member already)

        return base
    }

    /**
     * Intialise a new step flow with all the given steps
     */
    constructor(steps: EditMemberStep[], items: RegisterItem[] = [], editMember?: MemberWithRegistrations, finishHandler?: (component: NavigationMixin) => Promise<void>) {
        this.steps = steps
        this.items = items

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
                if (this.force || !s.shouldDelete(details, this.editMember ?? undefined, this.items)) {
                    if (!s.shouldReview(details, this.editMember ?? undefined, this.items)) {
                        continue
                    }
                    return s
                }

                // skip this step
                s.delete(details)
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
        return await step.getComponent({
            // Details to check if anything is changed
            originalDetails: this.cloneDetails(details),
            
            // Details to edit (can happen directly, no need to copy again)
            details: this.cloneDetails(details),

            member: this.editMember,
            items: this.items,

            isNew: this.isNew,
            nextText: hasNext ? "Doorgaan" : this.lastButtonText,

            // Save details on complete
            saveHandler: async (details: MemberDetails, component: NavigationMixin): Promise<void> => {
                const next = await this.getNextComponent(step, details)

                if (!next && this.lastSaveHandler) {
                    // Allow to still make changes to  the given details before saving it
                    await this.lastSaveHandler(details)
                }

                // Save details AFTER determining the next component (because delete behaviour might update the details)
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