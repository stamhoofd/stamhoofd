import { Parent } from "../models/Parent";
import { ParentType } from "../models/ParentType";

var faker = require("faker");

export class ParentFactory {
    static create(): Parent {
        var parent = new Parent();
        parent.firstName = faker.name.firstName();
        parent.lastName = faker.name.lastName();
        parent.type = Math.random() >= 0.5 ? ParentType.Mother : ParentType.Father;
        return parent;
    }
}
