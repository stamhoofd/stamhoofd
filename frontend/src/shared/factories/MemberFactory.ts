import { Member } from "../models/Member";
import { ParentFactory } from "./ParentFactory";
import { AddressFactory } from "./AddressFactory";
import { Gender } from "../models/Gender";
import { Factory } from "./Factory";
import { ParentType } from "../models/ParentType";
import { EmergencyContactFactory } from "./EmergencyContactFactory";

export class MemberFactoryOptions {
    minAge: number = 6;
    maxAge: number = 18;
}

export class MemberFactory extends Factory<Member> {
    options: MemberFactoryOptions;

    constructor(options: MemberFactoryOptions) {
        super(options);
        this.options = options;
    }

    create(): Member {
        var member = new Member();
        member.id = Math.floor(Math.random() * 99999999999);

        member.paid = Math.random() >= 0.1;
        member.gender = Math.random() >= 0.05 ? (Math.random() >= 0.5 ? Gender.Male : Gender.Female) : Gender.Other;
        member.firstName = this.randomFirstName(member.gender);

        member.createdOn = new Date(new Date().getTime() - Math.floor(Math.random() * 24 * 60 * 60 * 31 * 2 * 1000));
        member.birthDay = new Date(
            new Date().getFullYear() -
                (this.options.minAge + Math.floor(Math.random() * (this.options.maxAge - this.options.minAge + 1))),
            Math.floor(Math.random() * 12), // 11 = 12
            Math.floor(Math.random() * 31)
        );

        // For now only generate -18
        member.address = null;

        if (member.age >= 14) {
            member.phone =
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
        }

        var parentFactory = new ParentFactory({});

        member.parents.push(parentFactory.create());

        if (Math.random() >= 0.1) {
            member.parents.push(parentFactory.create());

            if (Math.random() >= 0.1) {
                member.parents[1].address = member.parents[0].address;
            }
        }

        if (member.parents.length == 2 && Math.random() >= 0.9) {
            member.lastName = member.parents[0].lastName + "-" + member.parents[1].lastName;
        } else {
            if (member.parents[0].type == ParentType.Father) {
                member.lastName = member.parents[0].lastName;
            } else if (member.parents[1] && member.parents[1].type == ParentType.Father) {
                member.lastName = member.parents[1].lastName;
            } else {
                member.lastName = member.parents[0].lastName;
            }
        }

        var emergencyContactFactory = new EmergencyContactFactory({});
        member.emergencyContacts.push(emergencyContactFactory.create());
        if (Math.random() >= 0.9) {
            member.emergencyContacts.push(emergencyContactFactory.create());
        }
        return member;
    }
}
