export enum ParentType {
    Mother = "Mother",
    Father = "Father",
    Other = "Other",
}

export class ParentTypeHelper {
    static getName(type: ParentType): string {
        switch (type) {
            case ParentType.Mother:
                return "Mama";
            case ParentType.Father:
                return "Papa";
            case ParentType.Other:
                return "Voogd";
        }
    }
}
