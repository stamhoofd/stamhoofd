export enum ParentType {
    Mother = "Mother",
    Father = "Father",

    Stepfather = "Stepfather",
    Stepmother = "Stepmother",

    Parent1 = "Parent1",
    Parent2 = "Parent2",
    Other = "Other",
}

export class ParentTypeHelper {
    static getName(type: ParentType): string {
        switch (type) {
            case ParentType.Mother:
                return "Mama";
            case ParentType.Father:
                return "Papa";
            case ParentType.Stepmother:
                return "Plusmama";
            case ParentType.Stepfather:
                return "Pluspapa";
            case ParentType.Parent1:
                return "Ouder 1";
            case ParentType.Parent2:
                return "Ouder 2";
            case ParentType.Other:
                return "Voogd";
        }
    }

    static getPublicTypes(): ParentType[] {
        return [ParentType.Mother, ParentType.Father, ParentType.Stepmother, ParentType.Stepfather, ParentType.Other]
    }
}
