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
                return $t(`4b2e0cb1-29e2-421d-a1c5-19a346a400cd`);
            case ParentType.Father:
                return $t(`2f92cf37-00f5-41fe-bf7a-f309c38eed10`);
            case ParentType.Stepmother:
                return $t(`5e104255-3930-45ab-9a4b-1bd2135259ec`);
            case ParentType.Stepfather:
                return $t(`53cfa3d9-7750-4332-9da7-6e6e73232ddb`);
            case ParentType.Parent1:
                return $t(`7f4020d6-9420-458a-9f79-7c5526ab0b23`);
            case ParentType.Parent2:
                return $t(`a9bb0b5d-24f4-4eed-b349-cab2c87fe305`);
            case ParentType.Other:
                return $t(`b92994d7-c8d7-4607-9e70-3a692715bddd`);
            case ParentType.FosterParent:
                return $t(`33557539-2f23-4243-9b81-20065d19e9d8`);
        }
    }

    static getPublicTypes(): ParentType[] {
        return [ParentType.Mother, ParentType.Father, ParentType.Stepmother, ParentType.Stepfather, ParentType.FosterParent, ParentType.Other];
    }
}
