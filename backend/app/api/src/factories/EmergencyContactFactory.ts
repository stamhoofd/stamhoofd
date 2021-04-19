import { Factory } from "@simonbackx/simple-database";
import { EmergencyContact, Gender } from "@stamhoofd/structures";

interface Options { }

export class EmergencyContactFactory extends Factory<Options, EmergencyContact> {

    create(): Promise<EmergencyContact> {
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

        return Promise.resolve(contact);
    }
}
