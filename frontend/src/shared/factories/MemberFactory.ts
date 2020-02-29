import { Member } from "../models/Member";
import { ParentFactory } from "./ParentFactory";
import { AddressFactory } from "./AddressFactory";
import { Gender } from "../models/Gender";

var faker = require("faker");

export class MemberFactory {
    static createMultiple(amount: number = 40) {
        var arr = [];
        for (let index = 0; index < amount; index++) {
            arr.push(this.create());
        }
        return arr;
    }
    static create(): Member {
        var member = new Member();
        member.id = Math.floor(Math.random() * 99999999999);
        member.firstName = faker.name.firstName();
        member.lastName = faker.name.lastName();
        member.paid = Math.random() >= 0.1;
        member.gender = Math.random() >= 0.05 ? (Math.random() >= 0.5 ? Gender.Male : Gender.Female) : Gender.Other;

        // For now only generate -18
        member.address = null;

        member.parents.push(ParentFactory.create());

        if (Math.random() >= 0.1) {
            member.parents.push(ParentFactory.create());
        }

        return member;
    }
}
