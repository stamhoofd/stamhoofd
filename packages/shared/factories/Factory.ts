import { Gender } from "../models/Gender";
import BoyNames from "./data/boys";
import GirlNames from "./data/girls";
import FamilyNames from "./data/family-names";

export abstract class Factory<Model> {
    options: object;
    constructor(options: object) {
        this.options = options;
    }
    abstract create(): Model;

    randomArray(arr: Array<any>): any {
        const int = Math.floor(Math.random() * arr.length);
        return arr[int];
    }

    randomFirstName(gender: Gender): string {
        let names: string[] = [];
        switch (gender) {
            case Gender.Male:
                names = BoyNames;
                break;
            case Gender.Female:
                names = GirlNames;
                break;
            case Gender.Other:
                names = [...BoyNames, ...GirlNames];
                break;
        }
        return this.randomArray(names);
    }

    randomLastName(): string {
        return this.randomArray(FamilyNames);
    }

    createMultiple(amount = 40): Array<Model> {
        const arr = [];
        for (let index = 0; index < amount; index++) {
            arr.push(this.create());
        }
        return arr;
    }
}
