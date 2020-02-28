import { Address } from "../models/Address";

var faker = require("faker");

export class AddressFactory {
    static create(): Address {
        var address = new Address();
        address.street = faker.address.streetName();
        address.number = Math.floor(Math.random() * 300) + 1 + "";
        address.city = AddressFactory.randomArray(["Wetteren", "Schellebelle", "Wichelen", "Massemen", "Laarne"]);
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

    static randomArray(arr: Array<any>): any {
        var int = Math.floor(Math.random() * arr.length);
        return arr[int];
    }
}
