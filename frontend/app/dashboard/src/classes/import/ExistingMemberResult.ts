import { AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { MemberDetails, Organization, Platform, PlatformFamily, PlatformMember, Version } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { ImportingRegistration } from './ImportMemberAccumulatedResult';
import { ImportMemberBase } from './ImportMemberBase';

export class ImportMemberResult {
    private _patch: AutoEncoderPatchType<MemberDetails>;
    readonly existingMember: PlatformMember | null = null;
    readonly details: MemberDetails;
    readonly registration = new ImportingRegistration();
    readonly isExisting: boolean;
    readonly memberId: string;
    readonly organization: Organization;
    private _newPlatformMember: PlatformMember | null = null;
    private _cachedDetails: MemberDetails | null = null;

    get patchedDetails() {
        if (this._cachedDetails) {
            return this._cachedDetails;
        }

        const details = this.details.patch(this._patch);
        details.cleanData();
        this._cachedDetails = details;

        return details;
    }

    get newPlatformMember() {
        return this._newPlatformMember;
    }

    getPatch() {
        return this._patch;
    }

    constructor({
        existingMember,
        organization,
    }: {
        existingMember: PlatformMember | null;
        organization: Organization;
    }) {
        this.organization = organization;

        if (existingMember) {
            this.existingMember = existingMember;
            this.details = existingMember.member.details;
            this.memberId = existingMember.id;
        }
        else {
            // todo?
            this.memberId = uuidv4();
            this.details = MemberDetails.create({});
        }

        this._patch = MemberDetails.patch({});

        this.isExisting = existingMember !== null;
    }

    hasChanges() {
        if (this.isExisting) {
            return patchContainsChanges(this._patch, this.details, { version: Version });
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
}

export class ExistingMemberResult {
    readonly existingMember: PlatformMember | null = null;
    private _isEqual: boolean = false;

    get name() {
        return this.baseMemerData.firstName + ' ' + this.baseMemerData.lastName;
    }

    get birthDayFormatted() {
        const birthDay = this.baseMemerData.birthDay;

        if (!birthDay) {
            return null;
        }

        return Formatter.date(birthDay, true);
    }

    get isEqual() {
        return this._isEqual;
    }

    get isProbablyEqual() {
        return !this.isEqual && this.existingMember !== null;
    }

    constructor(readonly baseMemerData: ImportMemberBase, allMembers: PlatformMember[], readonly organization: Organization) {
        const { birthDay, firstName, lastName } = this.baseMemerData;

        if (firstName === null || lastName === null) {
            return;
        }

        if (birthDay !== null) {
            const equalMember = allMembers.find(m => isMemberEqual(m, birthDay, firstName, lastName));
            if (equalMember) {
                this.existingMember = equalMember;
                this._isEqual = true;
                return;
            }
        }

        const probablyEqualMember = allMembers.find(m => isMemberProbablyEqual(m, birthDay, firstName, lastName));
        if (probablyEqualMember) {
            this.existingMember = probablyEqualMember;
            return;
        }
    }

    markEqual() {
        this._isEqual = true;
    }

    markNotEqual() {
        this._isEqual = false;
    }

    toImportMemberResult() {
        return new ImportMemberResult({
            existingMember: this.isEqual ? this.existingMember : null,
            organization: this.organization,
        });
    }
}

function isMemberEqual(member: PlatformMember, birthDay: Date | null | undefined, firstName: string, lastName: string): boolean {
    const memberDetails = member.member.details;

    if (!birthDay || memberDetails.birthDay === null || birthDay.getTime() !== memberDetails.birthDay.getTime()) {
        return false;
    }

    return StringCompare.typoCount(memberDetails.firstName + ' ' + memberDetails.lastName, firstName + ' ' + lastName) === 0 && StringCompare.typoCount(Formatter.dateNumber(memberDetails.birthDay), Formatter.dateNumber(memberDetails.birthDay)) === 0;
}

function isMemberProbablyEqual(member: PlatformMember, birthDay: Date | null | undefined, firstName: string, lastName: string): boolean {
    const memberDetails = member.member.details;

    if (!memberDetails.birthDay || !birthDay) {
        return StringCompare.typoCount(memberDetails.firstName + ' ' + memberDetails.lastName, firstName + ' ' + lastName) === 0;
    }
    const t = StringCompare.typoCount(memberDetails.firstName + ' ' + memberDetails.lastName, firstName + ' ' + lastName);
    const y = StringCompare.typoCount(Formatter.dateNumber(memberDetails.birthDay), Formatter.dateNumber(birthDay));

    if (t + y <= 3 && y <= 1 && t < 0.4 * Math.min(firstName.length + lastName.length, memberDetails.firstName.length + memberDetails.lastName.length)) {
        return true;
    }
    return false;
}
