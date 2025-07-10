import { AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { Group, MemberDetails, Organization, Parent, Platform, PlatformFamily, PlatformMember, RecordAnswer, Version } from '@stamhoofd/structures';
import { ImportRegistrationResult } from './ImportRegistrationResult';

/**
 * Class with data concerning a new or existing member
 * that is being imported (from a spreadsheet).
 */
export class ImportMemberResult {
    private _patch: AutoEncoderPatchType<MemberDetails>;

    /**
     * The base details of the member (= the existing details if the member exists or else the default details on create)
     */
    private readonly baseDetails: MemberDetails;

    /**
     * Class with data concerning the registration of a member that is being imported (from a spreadsheet).
     */
    readonly importRegistrationResult = new ImportRegistrationResult();

    /**
     * Whether the member already exists
     */
    readonly isExisting: boolean;

    /**
     * The existing platform member (if the member exists)
     */
    readonly existingMember: PlatformMember | null = null;

    /**
     * The organization the member will be registered for on import
     */
    readonly organization: Organization;

    /**
     * The new platform member if the member does not exist
     */
    private _newPlatformMember: PlatformMember | null = null;

    private _cachedDetails: MemberDetails | null = null;

    /**
     * The platform member that was imported (when the member is patched/put in the backend (=imported)
     */
    private _importedPlatformMember: PlatformMember | null = null;

    /**
     * Whether the registration is imported already
     */
    private _isRegistrationImported = false;

    /**
     * Whether the payment is imported already
     */
    private _isPaymentImported = false;

    /**
     * The group that is in the checkout for the registration
     */
    private _checkedOutGroup: Group | null = null;

    /**
     * The group that is in the checkout for the registration
     */
    get checkedOutGroup() {
        return this._checkedOutGroup;
    }

    get patchedDetails() {
        if (this._cachedDetails) {
            return this._cachedDetails;
        }

        const details = this.baseDetails.patch(this._patch);
        this._cachedDetails = details;

        return details;
    }

    /**
     * The new platform member if the member does not exist
     */
    get newPlatformMember() {
        return this._newPlatformMember;
    }

    /**
     * Whether the member is patched/put in the backend (=imported)
     */
    get isMemberImported() {
        return this._importedPlatformMember !== null;
    }

    /**
     * Whether the registration is imported already
     */
    get isRegistrationImported() {
        return this._isRegistrationImported;
    }

    /**
     * Whether the payment is imported already
     */
    get isPaymentImported() {
        return this._isPaymentImported;
    }

    /**
     * The platform member that was imported (when the member is patched/put in the backend (=imported)
     */
    get registeredPlatformMember() {
        return this._importedPlatformMember;
    }

    constructor(
        /**
         * The row number in the spreadsheet
         */
        readonly row: number, {
            existingMember,
        organization,
        }: {
            existingMember: PlatformMember | null;
            organization: Organization;
        }) {
        this.organization = organization;

        if (existingMember) {
            this.existingMember = existingMember;
            this.baseDetails = existingMember.member.details;
        }
        else {
            this.baseDetails = MemberDetails.create({});
        }

        this._patch = MemberDetails.patch({});

        this.isExisting = existingMember !== null;
    }

    setImportedPlatformMember(platformMember: PlatformMember) {
        this._importedPlatformMember = platformMember;
    }

    markRegistrationImported() {
        this._isRegistrationImported = true;
    }

    markPaymentImported() {
        this._isPaymentImported = true;
    }

    hasChanges() {
        if (this.isExisting) {
            return patchContainsChanges(this._patch, this.baseDetails, { version: Version });
        }

        return true;
    }

    addPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        this._cachedDetails = null;
        this._patch = this._patch.patch(MemberDetails.patch(newPatch));
    }

    private getNewOrExistingPlatformMember(platform: Platform) {
        if (this.existingMember) {
            return this.existingMember;
        }

        const family = new PlatformFamily({ contextOrganization: this.organization, platform });
        const newMember = family.newMember();
        this._newPlatformMember = newMember;
        return newMember;
    }

    getChangedParents(): Parent[] {
        const changedParents: Parent[] = [];
        const patched = this.patchedDetails;
        const patch = this._patch;

        if (patched.parents.length) {
            const changedParentIds = new Set();

            for (const parentPatch of patch.parents.getPatches()) {
                const parentId = parentPatch.id;
                changedParentIds.add(parentId);
            }

            for (const parentPut of patch.parents.getPuts()) {
                const parentId = parentPut.put.id;
                changedParentIds.add(parentId);
            }

            for (const parentId of changedParentIds.values()) {
                const parent = patched.parents.find(p => p.id === parentId);
                if (parent) {
                    changedParents.push(parent);
                }
            }
        }

        return changedParents;
    }

    getChangedRecordAnswers(): RecordAnswer[] {
        const changedRecordAnswers = new Set<RecordAnswer>();
        const existingRecordAnswers = [...(this.existingMember?.member.details.recordAnswers?.values() ?? [])];

        for (const value of this._patch.recordAnswers?.values() ?? []) {
            if (!value) {
                continue;
            }

            if (value.isPut()) {
                changedRecordAnswers.add(value);
            }
            else {
                const existingRecordAnswer = existingRecordAnswers.find(a => a.id === value.id);
                if (existingRecordAnswer) {
                    changedRecordAnswers.add(existingRecordAnswer);
                }
            }
        }

        return [...changedRecordAnswers.values()];
    }

    getPatchedPlatformMember(platform: Platform) {
        const platformMember = this.getNewOrExistingPlatformMember(platform);
        platformMember.addDetailsPatch(this._patch);
        return platformMember;
    }

    getCheckoutMember() {
        if (this.existingMember) {
            return this.existingMember;
        }

        if (this._newPlatformMember) {
            return this._newPlatformMember;
        }

        throw new Error('No member found');
    }

    setCheckedOutGroup(group: Group | null): void {
        this._checkedOutGroup = group;
    }
}
