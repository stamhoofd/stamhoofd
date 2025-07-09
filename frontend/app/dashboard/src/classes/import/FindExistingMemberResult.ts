import { Organization, PlatformMember } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { ImportMemberBaseResult } from './ImportMemberBaseResult';
import { ImportMemberResult } from './ImportMemberResult';

export class FindExistingMemberResult {
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

    constructor(readonly baseMemerData: ImportMemberBaseResult, allMembers: PlatformMember[], readonly organization: Organization) {
        const { birthDay, firstName, lastName, nationalRegisterNumber, memberNumber } = this.baseMemerData;

        if (firstName === null || lastName === null) {
            return;
        }

        const equalMember = allMembers.find(m => isMemberEqual(m, { birthDay, firstName, lastName, memberNumber, nationalRegisterNumber }));
        if (equalMember) {
            this.existingMember = equalMember;
            this._isEqual = true;
            return;
        }

        const probablyEqualMember = allMembers.find(m => isMemberProbablyEqual(m, { birthDay, firstName, lastName, memberNumber, nationalRegisterNumber }));
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
        return new ImportMemberResult(this.baseMemerData.row, {
            existingMember: this.isEqual ? this.existingMember : null,
            organization: this.organization,
        });
    }
}

function isMemberEqual(member: PlatformMember, { birthDay, firstName, lastName, memberNumber, nationalRegisterNumber }: { birthDay: Date | null | undefined; firstName: string; lastName: string; memberNumber?: string | null; nationalRegisterNumber?: string | null }): boolean {
    const memberDetails = member.member.details;

    if (nationalRegisterNumber && memberDetails.nationalRegisterNumber) {
        return memberDetails.nationalRegisterNumber === nationalRegisterNumber;
    }

    if (memberNumber && memberDetails.memberNumber) {
        return memberDetails.memberNumber === memberNumber;
    }

    if (!birthDay || memberDetails.birthDay === null || birthDay.getTime() !== memberDetails.birthDay.getTime()) {
        return false;
    }

    return StringCompare.typoCount(memberDetails.firstName + ' ' + memberDetails.lastName, firstName + ' ' + lastName) === 0 && StringCompare.typoCount(Formatter.dateNumber(memberDetails.birthDay), Formatter.dateNumber(memberDetails.birthDay)) === 0;
}

function isMemberProbablyEqual(member: PlatformMember, { birthDay, firstName, lastName, memberNumber, nationalRegisterNumber }: { birthDay: Date | null | undefined; firstName: string; lastName: string; memberNumber?: string | null; nationalRegisterNumber?: string | null }): boolean {
    const memberDetails = member.member.details;

    if (nationalRegisterNumber) {
        return memberDetails.nationalRegisterNumber === nationalRegisterNumber;
    }

    if (memberNumber) {
        return memberDetails.memberNumber === memberNumber;
    }

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
