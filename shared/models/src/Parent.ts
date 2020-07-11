import { Address } from "./Address";
import { ParentType } from "./ParentType";

export class Parent {
    type: ParentType = ParentType.Mother;
    firstName = "";
    lastName = "";
    phone: string | null = null;
    mail: string | null = null;
    address: Address | null;

    get name() {
        return this.firstName + " " + this.lastName;
    }
}
