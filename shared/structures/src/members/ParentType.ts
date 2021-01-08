export enum ParentType {
    Mother = "Mother",
    Father = "Father",
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
            case ParentType.Parent1:
                return "Ouder 1";
            case ParentType.Parent2:
                return "Ouder 2";
            case ParentType.Other:
                return "Voogd";
        }
    }

    static getPublicTypes(): ParentType[] {
        return [ParentType.Mother, ParentType.Father, ParentType.Other]
    }
}
