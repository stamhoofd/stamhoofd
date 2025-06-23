export enum MemberDetailsMatcherCategory {
    Member = 'Lid',
    Payment = 'Betaling',
    Parent1 = 'Ouder 1',
    Parent2 = 'Ouder 2',
}

// todo: translate?
export class MemberDetailsMatcherCategoryHelper {
    static getName(category: MemberDetailsMatcherCategory) {
        switch (category) {
            case MemberDetailsMatcherCategory.Member: return 'Lid';
            case MemberDetailsMatcherCategory.Payment: return 'Betaling';
            case MemberDetailsMatcherCategory.Parent1: return 'Ouder 1';
            case MemberDetailsMatcherCategory.Parent2: return 'Ouder 2';
            default: {
                const t: never = category;
                throw new Error('Unknown category ' + t);
            }
        }
    }
}
