import { Gender } from "./Gender";
import { Address } from "./Address";
import { Parent } from "./Parent";
import { EmergencyContact } from "./EmergencyContact";
import { Record } from "./Record";

export class Member {
    firstName: string = "";
    lastName: string = "";
    gender: Gender = Gender.Other;
    phone: string | null = null;
    mail: string | null = null;
    birthday: string = "1970-01-01";
    address: Address | null;

    parents: Parent[] = [];
    emergencyContacts: EmergencyContact[] = [];
    records: Record[] = [];

    get name() {
        return this.firstName + " " + this.lastName;
    }

    constructor() {}
}
