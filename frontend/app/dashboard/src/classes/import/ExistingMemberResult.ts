import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { MemberDetails, Organization, PlatformMember } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { ImportingRegistration, ImportMemberAccumulatedResult } from './ImportMemberAccumulatedResult';

export class ImportMemberResult {
    readonly patchedDetails: MemberDetails;
    readonly newDetails: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>;
    readonly existingMember: PlatformMember | null = null;
    readonly registration: ImportingRegistration;
    readonly isExisting: boolean;
    readonly memberId: string;
    readonly organization: Organization;

    constructor({
        existingMember,
        memberDetails,
        registration,
        organization,
    }: {
        existingMember: PlatformMember | null;
        memberDetails: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>;
        registration: ImportingRegistration;
        organization: Organization;
    }) {
        this.newDetails = memberDetails;
        this.registration = registration;
        this.organization = organization;

        if (existingMember) {
            this.existingMember = existingMember;
            this.patchedDetails = existingMember.member.details.patch(memberDetails);
            this.memberId = existingMember.id;
        }
        else {
            // todo
            this.patchedDetails = MemberDetails.create({}).patch(memberDetails);
            // todo?
            this.memberId = uuidv4();
        }

        this.isExisting = existingMember !== null;
    }
}

export class ExistingMemberResult {
    readonly existingMember: PlatformMember | null = null;
    private _isEqual: boolean = false;

    get details() {
        return this.accumulatedResult.data;
    }

    get name() {
        return this.details.firstName + ' ' + this.details.lastName;
    }

    get birthDayFormatted() {
        const birthDay = this.details.birthDay;

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

    get registration() {
        return this.accumulatedResult.registration;
    }

    constructor(readonly accumulatedResult: ImportMemberAccumulatedResult, allMembers: PlatformMember[], readonly organization: Organization) {
        const birthDay = this.details.birthDay;
        const firstName = this.details.firstName;
        const lastName = this.details.lastName;

        if (firstName === undefined || lastName === undefined) {
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
            memberDetails: this.details,
            registration: this.registration,
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
