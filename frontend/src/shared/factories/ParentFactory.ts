import { Parent } from "../models/Parent";
import { ParentType } from "../models/ParentType";
import { AddressFactory } from "./AddressFactory";

var faker = require("faker");

export class ParentFactory {
    static create(): Parent {
        var parent = new Parent();
        parent.firstName = faker.name.firstName();
        parent.lastName = faker.name.lastName();
        parent.type = Math.random() >= 0.5 ? ParentType.Mother : ParentType.Father;
        parent.address = AddressFactory.create();
        return parent;
    }
}
