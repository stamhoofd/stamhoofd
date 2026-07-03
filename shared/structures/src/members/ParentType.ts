export enum ParentType {
    Mother = 'Mother',
    Father = 'Father',

    Stepfather = 'Stepfather',
    Stepmother = 'Stepmother',
    FosterParent = 'FosterParent',

    /**
     * A partner of an adult member. Unlike other parent types, a partner keeps access to the member
     * regardless of the member's age (see MemberDetails.parentHasAccess).
     */
    Partner = 'Partner',

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
            case ParentType.Partner:
                return $t(`Partner`);
        }
    }

    static getPublicTypes(options?: { includePartner?: boolean }): ParentType[] {
        const types = [ParentType.Mother, ParentType.Father, ParentType.Stepmother, ParentType.Stepfather, ParentType.FosterParent, ParentType.Other];

        if (options?.includePartner) {
            types.push(ParentType.Partner);
        }

        return types;
    }
}
