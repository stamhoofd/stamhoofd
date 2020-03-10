import { Gender } from "./Gender";
import { Address } from "./Address";
import { ParentType } from "./ParentType";

export class Parent {
    type: ParentType = ParentType.Mother;
    firstName: string = "";
    lastName: string = "";
    phone: string | null = null;
    mail: string | null = null;
    address: Address | null;

    get name() {
        return this.firstName + " " + this.lastName;
    }

    constructor() {}
}
