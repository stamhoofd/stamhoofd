export enum ParentType {
    Mother = 'Mother',
    Father = 'Father',

    Stepfather = 'Stepfather',
    Stepmother = 'Stepmother',
    FosterParent = 'FosterParent',

    Parent1 = 'Parent1',
    Parent2 = 'Parent2',
    Other = 'Other',
}

export class ParentTypeHelper {
    static getName(type: ParentType): string {
        switch (type) {
            case ParentType.Mother:
                return $t(`%2Z`);
            case ParentType.Father:
                return $t(`%2Y`);
            case ParentType.Stepmother:
                return $t(`%qd`);
            case ParentType.Stepfather:
                return $t(`%qe`);
            case ParentType.Parent1:
                return $t(`%qf`);
            case ParentType.Parent2:
                return $t(`%qg`);
            case ParentType.Other:
                return $t(`%qh`);
            case ParentType.FosterParent:
                return $t(`%qi`);
        }
    }

    static getPublicTypes(): ParentType[] {
        return [ParentType.Mother, ParentType.Father, ParentType.Stepmother, ParentType.Stepfather, ParentType.FosterParent, ParentType.Other];
    }
}
