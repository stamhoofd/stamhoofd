export class ImportMemberBase {
    private _firstName: string | null = null;
    private _lastName: string | null = null;
    private _birthDay: Date | null = null;

    get firstName() {
        return this._firstName;
    }

    get lastName() {
        return this._lastName;
    }

    get birthDay() {
        return this._birthDay;
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
}
