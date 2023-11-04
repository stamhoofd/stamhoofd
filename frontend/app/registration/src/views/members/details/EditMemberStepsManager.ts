import { Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { AskRequirement, FilterDefinition, MemberDetails, MemberDetailsWithGroups, MemberWithRegistrations, RecordCategory, RegisterItem, Version } from '@stamhoofd/structures';

import { MemberManager } from '../../../classes/MemberManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

export enum EditMemberStepType {
    "Details" = "Details",
    "Parents" = "Parents", // Only if meets criteria
    "EmergencyContact" = "EmergencyContact",
    "DataPermissions" = "DataPermissions",
    // TODO: Questions step
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
    onlyReviewIfMissing = false

    /**
     * Time in ms for when to force a review because the infomration is outdated
     */
    outdatedTime = 60*1000*60*24*31*3

    constructor(category: RecordCategory, forceReview = false, onlyReviewIfMissing = false) {
        this.category = category
        this.forceReview = forceReview
        this.onlyReviewIfMissing = onlyReviewIfMissing
    }

    async getComponentClass(): Promise<any> {
        return (await import(/* webpackChunkName: "EditMemberRecordCategoryView", webpackPrefetch: true */ './EditMemberRecordCategoryView.vue')).default;
    }

    async getComponent(baseProperties): Promise<ComponentWithProperties> {
        return new ComponentWithProperties(await this.getComponentClass(), { ...baseProperties, category: this.category })
    }

    shouldDelete(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean {
        // Delete all the information in this category, if this is not asked in the given category
        const definitions = MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member, registerItems: items})
        if (this.category.filter) {
            return !this.category.filter.enabledWhen.decode(definitions).doesMatch(
                new MemberDetailsWithGroups(details, member, items)
            ) || this.category.getAllFilteredRecords(
                new MemberDetailsWithGroups(details, member, items),
                definitions,
                details.dataPermissions?.value ?? false
            ).length == 0;
        }
        return this.category.getAllFilteredRecords(
            new MemberDetailsWithGroups(details, member, items), 
            definitions,
            details.dataPermissions?.value ?? false
        ).length == 0
    }

    isRequired(details: MemberDetails, member: MemberWithRegistrations | undefined, items: RegisterItem[]): boolean {
        const definitions = MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member, registerItems: items})
        if (this.category.filter) {
            if (this.category.filter.requiredWhen === null) {
                return false;
            }
            return this.category.filter.requiredWhen.decode(definitions).doesMatch(
                new MemberDetailsWithGroups(details, member, items)
            )
        }
        return true;
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
        const definitions = MemberDetailsWithGroups.getFilterDefinitions(OrganizationManager.organization, {member, registerItems: items})
        const records = this.category.getAllFilteredRecords(new MemberDetailsWithGroups(details, member, items), definitions, details.dataPermissions?.value ?? false)

        if (this.forceReview) {
            return records.length > 0
        }

        // Check all the properties in this category and check their last review times
        for (const record of records) {
            const answer = details.recordAnswers.find(a => a.settings.id === record.id)
            if (!answer) {
                if (this.onlyReviewIfMissing) {
                    // We only want to ask missing data, but it isn't really missing data if it is an optional category
                    if (!this.isRequired(details, member, items)) {
                        continue
                    }
                }
                // This was never answered
                return true
            }

            if (!this.onlyReviewIfMissing && answer.isOutdated(this.outdatedTime)) {
                // This answer is outdated
                return true
            }

            try {
                answer.validate()
            } catch (e) {
                // This answer is not valid anymore
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
    onlyReviewIfMissing = false

    /**
     * Time in ms for when to force a review because the infomration is outdated
     */
    outdatedTime = 60*1000*60*24*31*3

    constructor(type: EditMemberStepType, forceReview = false, onlyReviewIfMissing = false) {
        this.type = type
        this.forceReview = forceReview
        this.onlyReviewIfMissing = onlyReviewIfMissing
    }

    getFilterDefinitionsForProperty(property: string): FilterDefinition[] {
        if (['parents', 'emergencyContacts'].includes(property)) {
            return MemberDetailsWithGroups.getBaseFilterDefinitions()
        }
        return MemberDetails.getBaseFilterDefinitions()
    }

    isPropertyEnabled(details: MemberDetails, name: "emailAddress" | "birthDay" | "phone" | "address") {
        return OrganizationManager.organization.meta.recordsConfiguration[name]?.enabledWhen?.decode(
            MemberDetails.getBaseFilterDefinitions()
        ).doesMatch(details) ?? false
    }

    isPropertyRequired(details: MemberDetails, name: "emailAddress" | "birthDay" | "phone" | "address") {
        return this.isPropertyEnabled(details, name) && (OrganizationManager.organization.meta.recordsConfiguration[name]?.requiredWhen?.decode(
            MemberDetails.getBaseFilterDefinitions()
        ).doesMatch(details) ?? false)
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
                // We still have all the data. Ask everything that is older than 3 months
                if (!this.onlyReviewIfMissing && member.details.reviewTimes.isOutdated("details", this.outdatedTime)) {
                    return true
                }

                // Check missing information
                if (!member.details.phone && this.isPropertyRequired(details, 'phone')) {
                    return true
                }

                if (!member.details.email && this.isPropertyRequired(details, 'emailAddress')) {
                    return true
                }

                if (!member.details.address && this.isPropertyRequired(details, 'address')) {
                    return true
                }

                if (!member.details.birthDay && this.isPropertyRequired(details, 'birthDay')) {
                    return true
                }

                return false
            }

            case EditMemberStepType.Parents: {
                // We still have all the data. Ask everything that is older than 3 months
                return (!this.onlyReviewIfMissing && member.details.reviewTimes.isOutdated("parents", this.outdatedTime)) || (member.details.parents.length == 0 && OrganizationManager.organization.meta.recordsConfiguration.parents?.requiredWhen?.decode(this.getFilterDefinitionsForProperty('parents')).doesMatch(new MemberDetailsWithGroups(details, member, items)) === true)
            }

            case EditMemberStepType.EmergencyContact: {
                if (member.activeRegistrations.length == 0 && items.reduce((allWaitingList, item) => item.waitingList && allWaitingList, true)) {
                    // All items are on the waiting list only
                    // So never ask this information, since we don't need it right now
                    return false
                }

                return (!this.onlyReviewIfMissing && member.details.reviewTimes.isOutdated("emergencyContacts", this.outdatedTime)) || (member.details.emergencyContacts.length == 0 && OrganizationManager.organization.meta.recordsConfiguration.emergencyContacts?.requiredWhen?.decode(this.getFilterDefinitionsForProperty('emergencyContacts')).doesMatch(new MemberDetailsWithGroups(details, member, items)) === true)
            }

            case EditMemberStepType.DataPermissions: {
                return (!this.onlyReviewIfMissing && member.details.dataPermissions?.value === false) || !member.details.dataPermissions || (!this.onlyReviewIfMissing && member.details.dataPermissions.isOutdated(this.outdatedTime))
            }

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
            case EditMemberStepType.DataPermissions: return (await import(/* webpackChunkName: "MemberDataPermissionView", webpackPrefetch: true */ './MemberDataPermissionView.vue')).default;

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
            case EditMemberStepType.Parents: return !OrganizationManager.organization.meta.recordsConfiguration.parents?.enabledWhen?.decode(this.getFilterDefinitionsForProperty('parents')).doesMatch(new MemberDetailsWithGroups(details, member, items));

            case EditMemberStepType.EmergencyContact: return !OrganizationManager.organization.meta.recordsConfiguration.emergencyContacts?.enabledWhen?.decode(this.getFilterDefinitionsForProperty('emergencyContacts')).doesMatch(new MemberDetailsWithGroups(details, member, items));

            case EditMemberStepType.DataPermissions: return OrganizationManager.organization.meta.recordsConfiguration.dataPermission === null;
        }
        return false
    }

    /// What happens when shouldDelete returned true, most of the time we need to clear some old data
    delete(details: MemberDetails) {
        switch (this.type) {
            // Skip parents for > 18 and has address, or > 24 (no matter of address)
            case EditMemberStepType.Parents: 
                details.parents = []
                details.reviewTimes.removeReview("parents")
                break;

            // Skip emergency contacts if not asked by organization
            case EditMemberStepType.EmergencyContact: 
                details.emergencyContacts = []
                details.reviewTimes.removeReview("emergencyContacts")
                break;

            case EditMemberStepType.DataPermissions: 
                details.dataPermissions = undefined
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

    /**
     * force to do all steps, even when they are not enabled for the member (and not skip them)
     * This is not the same as forceReview
     */ 
    force = false

    /**
     * Text in the button on the last step
     */
    lastButtonText: string

    steps: EditMemberStep[]
    finishHandler: (component: NavigationMixin) => Promise<void>;
    lastSaveHandler?: (details: MemberDetails) => Promise<void>;

    static getAllSteps(items: RegisterItem[] = [], member?: MemberWithRegistrations, forceReview = false, onlyReviewIfMissing = false): EditMemberStep[] {
        const base: EditMemberStep[] = [
            new BuiltInEditMemberStep(EditMemberStepType.Details, forceReview, onlyReviewIfMissing),
            new BuiltInEditMemberStep(EditMemberStepType.Parents, forceReview, onlyReviewIfMissing),
            new BuiltInEditMemberStep(EditMemberStepType.EmergencyContact, forceReview, onlyReviewIfMissing),
            new BuiltInEditMemberStep(EditMemberStepType.DataPermissions, forceReview, onlyReviewIfMissing),
        ]

        for (const category of OrganizationManager.organization.meta.recordsConfiguration.recordCategories) {
            base.push(new RecordCategoryStep(category, forceReview, onlyReviewIfMissing))
        }

        // TODO: categories that are bound to a single group (thats why we need items and member already)

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
                    message: "Er ging iets mis bij het opslaan. Herlaad de pagina en probeer opnieuw."
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

    hasSteps(): boolean {
        return !!this.getNextStep(undefined, this.cloneDetails())
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
        const originalDetails = this.cloneDetails(details)
        return await step.getComponent({
            // Details to check if anything is changed
            originalDetails,
            
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

                // Mark as saved (so there is no confirm before dismiss any longer)
                originalDetails.set(details)

                if (!next) {
                    await this.finishHandler(component)
                } else {
                    component.show(next)
                }
            }
        })
    }
}