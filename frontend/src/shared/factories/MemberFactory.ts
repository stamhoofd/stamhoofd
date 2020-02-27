import { Member } from "../models/Member";

var faker = require("faker");
console.log(faker);

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
        member.firstName = faker.name.firstName();
        member.lastName = faker.name.lastName();
        return member;
    }
}
