import { Address } from "../models/Address";
import { Factory } from "./Factory";
import StreetNames from "./data/streets";

interface Options {}

export class AddressFactory extends Factory<Address> {
    options: Options;

    constructor(options: Options) {
        super(options);
        this.options = options;
    }

    randomStreet(): string {
        return this.randomArray(StreetNames);
    }

    create(): Address {
        const address = new Address();
        address.street = this.randomStreet();
        address.number = Math.floor(Math.random() * 300) + 1 + "";
        address.city = this.randomArray(["Wetteren", "Schellebelle", "Wichelen", "Massemen", "Laarne"]);
        switch (address.city) {
            case "Wetteren":
                address.postalCode = "9230";
                break;
            case "Schellebelle":
                address.postalCode = "9230";
                break;
            case "Wichelen":
                address.postalCode = "9230";
                break;
            case "Massemen":
                address.postalCode = "9230";
                break;
            case "Laarne":
                address.postalCode = "9230";
                break;

            default:
                address.postalCode = "9000";
                break;
        }
        address.country = "BE";

        return address;
    }
}
