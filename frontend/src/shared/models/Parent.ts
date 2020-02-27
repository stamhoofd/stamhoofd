import { Gender } from "./Gender";
import { Address } from "./Address";

export class Parent {
    firstname: string = "";
    lastname: string = "";
    phone: string | null = null;
    mail: string | null = null;
    address: Address | null;

    get name() {
        return this.firstname + " " + this.lastname;
    }

    constructor() {}
}
