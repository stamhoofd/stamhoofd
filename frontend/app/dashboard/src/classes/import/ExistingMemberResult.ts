import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { MemberDetails, Organization, PlatformMember } from '@stamhoofd/structures';
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

    get patchedDetails() {
        return this.details.patch(this._patch);
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

    addPatch(newPatch: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        this._patch = this._patch.patch(MemberDetails.patch(newPatch));
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

    if (!birthDay || memberDetails.birthDay === null || birthDay !== memberDetails.birthDay) {
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
