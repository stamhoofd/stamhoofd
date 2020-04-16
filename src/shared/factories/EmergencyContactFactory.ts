import { EmergencyContact } from "../models/EmergencyContact";
import { ParentType } from "../models/ParentType";
import { AddressFactory } from "./AddressFactory";
import { Factory } from "./Factory";
interface Options {}
import { Gender } from "../models/Gender";

export class EmergencyContactFactory extends Factory<EmergencyContact> {
    options: Options;

    constructor(options: Options) {
        super(options);
        this.options = options;
    }

    create(): EmergencyContact {
        const contact = new EmergencyContact();
        contact.title = this.randomArray([
            "Oma",
            "Opa",
            "Tante",
            "Buurvrouw",
            "Nonkel",
            "Pepe",
            "Grootvader",
            "Grootmoeder",
            "Meme",
            "Vriend van de familie",
            "Plusmama",
            "Pluspapa",
            "Stiefvader",
            "Stiefmoeder",
        ]);
        contact.name = this.randomFirstName(Gender.Other) + " " + this.randomLastName();

        contact.phone =
            "+32 47" +
            Math.floor(Math.random() * 10) +
            " " +
            Math.floor(Math.random() * 10) +
            Math.floor(Math.random() * 10) +
            " " +
            Math.floor(Math.random() * 10) +
            Math.floor(Math.random() * 10) +
            " " +
            Math.floor(Math.random() * 10) +
            Math.floor(Math.random() * 10);

        return contact;
    }
}
