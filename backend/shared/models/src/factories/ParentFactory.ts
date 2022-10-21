import { Factory } from "@simonbackx/simple-database";
import { Gender, Parent, ParentType } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";

import { AddressFactory } from "./AddressFactory";

interface Options {
    type?: ParentType;
}

export class ParentFactory extends Factory<Options, Parent> {
    async create(): Promise<Parent> {
        const parent = new Parent();
        parent.type = this.options.type ?? this.randomArray([ParentType.Mother, ParentType.Father, ParentType.Stepfather, ParentType.Stepmother, ParentType.Other]);
        if (parent.type == ParentType.Other) {
            // Second spin
            parent.type = this.options.type ?? this.randomArray([ParentType.Mother, ParentType.Father, ParentType.Stepfather, ParentType.Stepmother, ParentType.Other]);
        }

        parent.firstName = this.randomFirstName(parent.type == ParentType.Mother ? Gender.Female : Gender.Male);
        parent.lastName = this.randomLastName();

        parent.address = await new AddressFactory({}).create();
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

        parent.email =
            Formatter.slugEmail(
                (Math.random() >= 0.5 ? parent.firstName.toLowerCase() : parent.firstName.toLowerCase()[0]) +
                (Math.random() >= 0.5 ? "." : Math.random() >= 0.5 ? "_" : "") +
                parent.lastName.toLowerCase().replace(" ", "")
            ) +
            "@" +
            this.randomArray([
                "geen-email.com"
            ]);
        return parent;
    }
}
