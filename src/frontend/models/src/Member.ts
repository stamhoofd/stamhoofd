import { Address } from "./Address";
import { EmergencyContact } from "./EmergencyContact";
import { Gender } from "./Gender";
import { Group } from "./Group";
import { Parent } from "./Parent";
import { Record } from "./Record";

export class Member {
    id = 0;
    firstName = "";
    lastName = "";
    gender: Gender = Gender.Other;
    phone: string | null = null;
    mail: string | null = null;
    birthDay: Date = new Date("1970-01-01");
    address: Address | null;

    parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];
    doctor: EmergencyContact | null = null;

    group: Group | null = null;

    paid = false;
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
        const today = new Date();
        let age = today.getFullYear() - this.birthDay.getFullYear();
        const m = today.getMonth() - this.birthDay.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < this.birthDay.getDate())) {
            age--;
        }
        return age;
    }

    get birthDayFormatted() {
        const date = new Date(this.birthDay);
        const options = { year: "numeric", month: "long", day: "numeric" };
        return date.toLocaleDateString("nl-BE", options);
    }

    matchQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase();
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
