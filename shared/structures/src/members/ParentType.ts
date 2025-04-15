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
                return $t(`Mama`);
            case ParentType.Father:
                return $t(`Papa`);
            case ParentType.Stepmother:
                return $t(`Plusmama`);
            case ParentType.Stepfather:
                return $t(`Pluspapa`);
            case ParentType.Parent1:
                return $t(`Ouder 1`);
            case ParentType.Parent2:
                return $t(`Ouder 2`);
            case ParentType.Other:
                return $t(`Voogd`);
            case ParentType.FosterParent:
                return $t(`Pleegouder`);
        }
    }

    static getPublicTypes(): ParentType[] {
        return [ParentType.Mother, ParentType.Father, ParentType.Stepmother, ParentType.Stepfather, ParentType.FosterParent, ParentType.Other];
    }
}
