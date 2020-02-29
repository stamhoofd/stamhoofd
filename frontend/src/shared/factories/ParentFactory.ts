import { Parent } from "../models/Parent";
import { ParentType } from "../models/ParentType";
import { AddressFactory } from "./AddressFactory";
import { Factory } from "./Factory";
interface Options {
    type: ParentType | null;
}
import { Gender } from "../models/Gender";

export class ParentFactory extends Factory<Parent> {
    options: Options;

    constructor(options: Options) {
        super(options);
        this.options = options;
    }

    create(): Parent {
        var parent = new Parent();
        parent.type = this.options.type ?? this.randomArray(Object.keys(ParentType));

        parent.firstName = this.randomFirstName(parent.type == ParentType.Mother ? Gender.Female : Gender.Male);
        parent.lastName = this.randomLastName();

        parent.address = new AddressFactory({}).create();
        parent.phone =
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

        parent.mail =
            (Math.random() >= 0.5 ? parent.firstName.toLowerCase() : parent.firstName.toLowerCase()[0]) +
            (Math.random() >= 0.5 ? "." : Math.random() >= 0.5 ? "_" : "") +
            parent.lastName.toLowerCase().replace(" ", "") +
            "@" +
            this.randomArray([
                "hotmail.com",
                "outlook.com",
                "telenet.be",
                "proximus.be",
                "live.com",
                "gmail.com",
                "icloud.com"
            ]);
        return parent;
    }
}
