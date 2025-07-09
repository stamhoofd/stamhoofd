/**
 * The base data for a member that is gathered when the member is imported.
 * This data is used for checking if the member already exists.
 */
export class ImportMemberBaseResult {
    private _firstName: string | null = null;
    private _lastName: string | null = null;
    private _birthDay: Date | null = null;
    private _memberNumber: string | null = null;
    private _nationalRegisterNumber: string | null = null;

    constructor(readonly row: number) {

    }

    get firstName() {
        return this._firstName;
    }

    get lastName() {
        return this._lastName;
    }

    get birthDay() {
        return this._birthDay;
    }

    get memberNumber() {
        return this._memberNumber;
    }

    get nationalRegisterNumber() {
        return this._nationalRegisterNumber;
    }

    setFirstName(firstName: string) {
        this._firstName = firstName;
    }

    setLastName(lastName: string) {
        this._lastName = lastName;
    }

    setBirthDay(birthDay: Date) {
        this._birthDay = birthDay;
    }

    setMemberNumber(memberNumber: string) {
        this._memberNumber = memberNumber;
    }

    setNationalRegisterNumber(nationalRegisterNumber: string) {
        this._nationalRegisterNumber = nationalRegisterNumber;
    }
}
