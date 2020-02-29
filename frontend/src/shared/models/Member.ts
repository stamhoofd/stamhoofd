import { Gender } from "./Gender";
import { Address } from "./Address";
import { Parent } from "./Parent";
import { EmergencyContact } from "./EmergencyContact";
import { Record } from "./Record";

export class Member {
    id: number = 0;
    firstName: string = "";
    lastName: string = "";
    gender: Gender = Gender.Other;
    phone: string | null = null;
    mail: string | null = null;
    birthDay: Date = new Date("1970-01-01");
    address: Address | null;

    parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];

    paid: boolean = false;
    createdOn: Date = new Date("1970-01-01");

    get name() {
        return this.firstName + " " + this.lastName;
    }

    get info(): string {
        return this.paid ? "" : "Lidgeld nog niet betaald";
    }

    get isNew(): boolean {
        return this.createdOn.getTime() > new Date().getTime() - 24 * 60 * 60 * 14 * 1000;
    }

    get age() {
        var today = new Date();
        var age = today.getFullYear() - this.birthDay.getFullYear();
        var m = today.getMonth() - this.birthDay.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < this.birthDay.getDate())) {
            age--;
        }
        return age;
    }

    get birthDayFormatted() {
        var date = new Date(this.birthDay);
        var options = { year: "numeric", month: "long", day: "numeric" };
        return date.toLocaleDateString("nl-BE", options);
    }

    constructor() {}

    matchQuery(query: string): boolean {
        var lowerQuery = query.toLowerCase();
        if (
            this.firstName.toLowerCase().includes(lowerQuery) ||
            this.lastName.toLowerCase().includes(lowerQuery) ||
            this.name.toLowerCase().includes(lowerQuery)
        ) {
            return true;
        }
        return false;
    }
}
