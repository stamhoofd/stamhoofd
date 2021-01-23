export enum MatcherCategory {
    Member = "Member",
    Payment = "Payment",
    Parent1 = "Parent1",
    Parent2 = "Parent2",
}

export class MatcherCategoryHelper {
    static getName(category: MatcherCategory) {
        switch(category) {
            case MatcherCategory.Member: return "Lid"
            case MatcherCategory.Payment: return "Betaling"
            case MatcherCategory.Parent1: return "Ouder 1"
            case MatcherCategory.Parent2: return "Ouder 2"
            default: {
                const t: never = category
                throw new Error("Unknown category " + t)
            }
        }
    }
}